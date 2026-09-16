import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/api-exception';
import { BOOKING_STATUS, ROLES } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import { AvailabilityService } from '../../domain/availability.service';
import type { Hotel, Review, Room, User } from '../../types/models';
import {
  CreateHotelDto,
  CreateReviewDto,
  HotelDetailQuery,
  HotelListQuery,
  UpdateHotelDto,
} from './dto/hotel.dto';

type HotelSummary = Omit<Hotel, 'policies' | 'rooms' | 'createdAt' | 'updatedAt'>;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents before slugging
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

@Injectable()
export class HotelsService {
  constructor(
    private readonly store: StoreService,
    private readonly availability: AvailabilityService,
  ) {}

  private summarise(hotel: Hotel): HotelSummary {
    return {
      id: hotel.id,
      slug: hotel.slug,
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      continent: hotel.continent,
      category: hotel.category,
      starRating: hotel.starRating,
      rating: hotel.rating,
      reviewsCount: hotel.reviewsCount,
      basePrice: hotel.basePrice,
      currency: hotel.currency,
      description: hotel.description,
      highlights: hotel.highlights,
      tags: hotel.tags,
      amenities: hotel.amenities,
      images: hotel.images,
      featured: hotel.featured,
      active: hotel.active,
    };
  }

  facets() {
    const hotels = this.store.all('hotels', (h) => h.active);
    const count = (key: 'continent' | 'country' | 'category') =>
      Object.entries(
        hotels.reduce<Record<string, number>>(
          (acc, h) => ({ ...acc, [h[key]]: (acc[h[key]] || 0) + 1 }),
          {},
        ),
      )
        .map(([value, total]) => ({ value, total }))
        .sort((a, b) => a.value.localeCompare(b.value));

    return {
      continents: count('continent'),
      countries: count('country'),
      categories: count('category'),
      amenities: [...new Set(hotels.flatMap((h) => h.amenities))].sort(),
      priceRange: {
        min: Math.min(...hotels.map((h) => h.basePrice)),
        max: Math.max(...hotels.map((h) => h.basePrice)),
      },
      total: hotels.length,
    };
  }

  list(query: HotelListQuery, user?: User) {
    const {
      q = '', continent, country, category, stars, amenities,
      minPrice, maxPrice, checkIn, checkOut, guests = '1',
      sort = 'recommended', page = '1', limit = '12', featured,
    } = query;

    const isStaff = Boolean(user && user.role !== ROLES.CUSTOMER);
    const needle = String(q).trim().toLowerCase();
    const wantedAmenities = amenities ? String(amenities).split(',').filter(Boolean) : [];
    const guestCount = Number(guests) || 1;

    let results = this.store.all('hotels').filter((hotel) => {
      // Deactivated hotels stay visible to staff so they can be managed.
      if (!hotel.active && !isStaff) return false;
      if (featured === 'true' && !hotel.featured) return false;
      if (continent && hotel.continent !== continent) return false;
      if (country && hotel.country !== country) return false;
      if (category && hotel.category !== category) return false;
      if (stars && hotel.starRating < Number(stars)) return false;
      if (minPrice && hotel.basePrice < Number(minPrice)) return false;
      if (maxPrice && hotel.basePrice > Number(maxPrice)) return false;
      if (wantedAmenities.length && !wantedAmenities.every((a) => hotel.amenities.includes(a))) {
        return false;
      }
      if (needle) {
        const haystack =
          `${hotel.name} ${hotel.city} ${hotel.country} ${hotel.continent} ${hotel.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (!hotel.rooms.some((room) => room.capacity >= guestCount)) return false;
      if (
        checkIn &&
        checkOut &&
        !this.availability.hotelHasAvailability(hotel, checkIn, checkOut, guestCount)
      ) {
        return false;
      }
      return true;
    });

    const sorters: Record<string, (a: Hotel, b: Hotel) => number> = {
      'price-asc': (a, b) => a.basePrice - b.basePrice,
      'price-desc': (a, b) => b.basePrice - a.basePrice,
      rating: (a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount,
      name: (a, b) => a.name.localeCompare(b.name),
      recommended: (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating,
    };
    results = [...results].sort(sorters[sort] || sorters.recommended);

    const total = results.length;
    const perPage = Math.min(Number(limit) || 12, 48);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    return {
      hotels: results.slice(start, start + perPage).map((hotel) => this.summarise(hotel)),
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        pages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  detail(id: string, query: HotelDetailQuery, user?: User) {
    const hotel = this.store.byId('hotels', id);
    if (!hotel) throw ApiException.notFound('That hotel does not exist.');
    if (!hotel.active && (!user || user.role === ROLES.CUSTOMER)) {
      throw ApiException.notFound('That hotel is not currently bookable.');
    }

    const { checkIn, checkOut, guests = '1' } = query;
    const reviews = this.store
      .all('reviews', (r) => r.hotelId === hotel.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      hotel: {
        ...hotel,
        rooms: this.availability.roomsWithAvailability(
          hotel,
          checkIn,
          checkOut,
          Number(guests) || 1,
        ),
      },
      reviews: reviews.slice(0, 20),
      reviewSummary: {
        count: reviews.length,
        average: reviews.length
          ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2))
          : hotel.rating,
      },
      unavailableDates: this.availability.soldOutDates(hotel),
    };
  }

  availabilityFor(id: string, query: HotelDetailQuery) {
    const hotel = this.store.byId('hotels', id);
    if (!hotel) throw ApiException.notFound('That hotel does not exist.');

    const { checkIn, checkOut, guests = '1' } = query;
    if (!checkIn || !checkOut) throw ApiException.badRequest('checkIn and checkOut are required.');
    if (checkIn >= checkOut) throw ApiException.badRequest('Check-out must be after check-in.');

    return {
      rooms: this.availability.roomsWithAvailability(hotel, checkIn, checkOut, Number(guests) || 1),
    };
  }

  // ------------------------------------------------------------------ reviews

  addReview(id: string, dto: CreateReviewDto, user: User): { review: Review } {
    const hotel = this.store.byId('hotels', id);
    if (!hotel) throw ApiException.notFound('That hotel does not exist.');

    // Only guests who actually completed a stay may review it.
    const stay = this.store.find(
      'bookings',
      (b) =>
        b.userId === user.id && b.hotelId === hotel.id && b.status === BOOKING_STATUS.CHECKED_OUT,
    );
    if (!stay) {
      throw ApiException.forbidden('You can review a hotel after you have completed a stay there.');
    }
    if (this.store.find('reviews', (r) => r.userId === user.id && r.hotelId === hotel.id)) {
      throw ApiException.conflict('You have already reviewed this hotel.');
    }

    const review = this.store.insert('reviews', {
      id: `rev_${Date.now().toString(36)}`,
      hotelId: hotel.id,
      userId: user.id,
      bookingId: stay.id,
      userName: user.name,
      rating: Number(dto.rating),
      title: dto.title.trim(),
      comment: dto.comment.trim(),
      createdAt: new Date().toISOString(),
    });

    // Keep the denormalised hotel rating in step with its reviews.
    const all = this.store.all('reviews', (r) => r.hotelId === hotel.id);
    this.store.update('hotels', hotel.id, {
      rating: Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(2)),
      reviewsCount: hotel.reviewsCount + 1,
    });

    return { review };
  }

  // -------------------------------------------------------------- admin CRUD

  create(dto: CreateHotelDto): { hotel: Hotel } {
    const base = Number(dto.basePrice);
    let slug = slugify(dto.name);
    if (this.store.byId('hotels', slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const rooms: Room[] = [
      { id: `${slug}-deluxe`, key: 'deluxe', name: 'Deluxe Room', description: 'Comfortable room with a seating area.', price: base, capacity: 2, beds: '1 king bed', sizeSqm: 36, count: 20 },
      { id: `${slug}-executive`, key: 'executive', name: 'Executive Suite', description: 'Separate living room and upgraded amenities.', price: Math.round(base * 1.85), capacity: 3, beds: '1 king + sofa bed', sizeSqm: 62, count: 8 },
      { id: `${slug}-signature`, key: 'signature', name: 'Signature Suite', description: 'The best rooms in the house.', price: Math.round(base * 3.1), capacity: 4, beds: '2 king beds', sizeSqm: 110, count: 3 },
    ];

    const hotel = this.store.insert('hotels', {
      id: slug,
      slug,
      name: dto.name.trim(),
      city: dto.city.trim(),
      country: dto.country.trim(),
      continent: dto.continent.trim(),
      category: dto.category,
      starRating: Number(dto.starRating),
      rating: 0,
      reviewsCount: 0,
      basePrice: base,
      currency: 'USD',
      description: dto.description.trim(),
      highlights: dto.highlights || [],
      tags: dto.tags || [],
      featured: Boolean(dto.featured),
      amenities: dto.amenities || ['Free WiFi', 'Room service'],
      images: ['a', 'b', 'c', 'd', 'e'].map(
        (s) => `https://picsum.photos/seed/${slug}-${s}/1600/1000`,
      ),
      policies: {
        checkIn: '15:00',
        checkOut: '11:00',
        cancellation: 'Free cancellation up to 48 hours before check-in.',
        children: 'Children of all ages are welcome.',
      },
      rooms,
      active: true,
      createdAt: new Date().toISOString(),
    });

    return { hotel };
  }

  update(id: string, dto: UpdateHotelDto): { hotel: Hotel } {
    const hotel = this.store.byId('hotels', id);
    if (!hotel) throw ApiException.notFound('That hotel does not exist.');

    // The DTO is the allow-list: the validation pipe has already dropped any
    // field not declared on it, so this can be spread straight in.
    const patch: Partial<Hotel> = { ...(dto as Partial<Hotel>) };

    // Re-price the room tiers proportionally when the base rate changes.
    if (dto.basePrice !== undefined && Number(dto.basePrice) !== hotel.basePrice) {
      const ratio = Number(dto.basePrice) / hotel.basePrice;
      patch.rooms = hotel.rooms.map((room) => ({ ...room, price: Math.round(room.price * ratio) }));
      patch.basePrice = Number(dto.basePrice);
    }

    return { hotel: this.store.update('hotels', hotel.id, patch) as Hotel };
  }

  remove(id: string) {
    const hotel = this.store.byId('hotels', id);
    if (!hotel) throw ApiException.notFound('That hotel does not exist.');

    const live = this.store.all(
      'bookings',
      (b) =>
        b.hotelId === hotel.id &&
        [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING, BOOKING_STATUS.CHECKED_IN].includes(
          b.status,
        ),
    );

    if (live.length > 0) {
      // Deactivating preserves history; a hard delete would orphan live stays.
      this.store.update('hotels', hotel.id, { active: false });
      return {
        hotel: this.store.byId('hotels', hotel.id),
        message: `${live.length} active booking(s) — the hotel was deactivated instead of deleted.`,
      };
    }

    this.store.remove('hotels', hotel.id);
    return { ok: true, message: 'Hotel deleted.' };
  }
}
