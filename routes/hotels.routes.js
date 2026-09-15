import { Router } from 'express';
import { db } from '../db/store.js';
import { BOOKING_STATUS, ROLES } from '../config.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { hotelHasAvailability, roomsWithAvailability, soldOutDates } from '../services/availability.js';

const router = Router();

const listHotels = () => db.all('hotels');

const summarise = (hotel) => ({
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
});

router.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    const hotels = listHotels().filter((h) => h.active);
    const count = (key) =>
      Object.entries(
        hotels.reduce((acc, h) => ({ ...acc, [h[key]]: (acc[h[key]] || 0) + 1 }), {})
      )
        .map(([value, total]) => ({ value, total }))
        .sort((a, b) => a.value.localeCompare(b.value));

    res.json({
      continents: count('continent'),
      countries: count('country'),
      categories: count('category'),
      amenities: [...new Set(hotels.flatMap((h) => h.amenities))].sort(),
      priceRange: {
        min: Math.min(...hotels.map((h) => h.basePrice)),
        max: Math.max(...hotels.map((h) => h.basePrice)),
      },
      total: hotels.length,
    });
  })
);

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const {
      q = '', continent, country, category, stars, amenities,
      minPrice, maxPrice, checkIn, checkOut, guests = 1,
      sort = 'recommended', page = 1, limit = 12, featured,
    } = req.query;

    const isStaff = req.user && req.user.role !== ROLES.CUSTOMER;
    const needle = String(q).trim().toLowerCase();
    const wantedAmenities = amenities ? String(amenities).split(',').filter(Boolean) : [];
    const guestCount = Number(guests) || 1;

    let results = listHotels().filter((hotel) => {
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
        const haystack = `${hotel.name} ${hotel.city} ${hotel.country} ${hotel.continent} ${hotel.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (!hotel.rooms.some((room) => room.capacity >= guestCount)) return false;
      if (checkIn && checkOut && !hotelHasAvailability(hotel, checkIn, checkOut, guestCount)) {
        return false;
      }
      return true;
    });

    const sorters = {
      'price-asc': (a, b) => a.basePrice - b.basePrice,
      'price-desc': (a, b) => b.basePrice - a.basePrice,
      rating: (a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount,
      name: (a, b) => a.name.localeCompare(b.name),
      recommended: (a, b) =>
        Number(b.featured) - Number(a.featured) || b.rating - a.rating,
    };
    results = [...results].sort(sorters[sort] || sorters.recommended);

    const total = results.length;
    const perPage = Math.min(Number(limit) || 12, 48);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    res.json({
      hotels: results.slice(start, start + perPage).map(summarise),
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        pages: Math.max(1, Math.ceil(total / perPage)),
      },
    });
  })
);

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const hotel = db.byId('hotels', req.params.id);
    if (!hotel) throw ApiError.notFound('That hotel does not exist.');
    if (!hotel.active && (!req.user || req.user.role === ROLES.CUSTOMER)) {
      throw ApiError.notFound('That hotel is not currently bookable.');
    }

    const { checkIn, checkOut, guests = 1 } = req.query;
    const reviews = db
      .all('reviews', (r) => r.hotelId === hotel.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      hotel: {
        ...hotel,
        rooms: roomsWithAvailability(hotel, checkIn, checkOut, Number(guests) || 1),
      },
      reviews: reviews.slice(0, 20),
      reviewSummary: {
        count: reviews.length,
        average: reviews.length
          ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2))
          : hotel.rating,
      },
      unavailableDates: soldOutDates(hotel),
    });
  })
);

router.get(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    const hotel = db.byId('hotels', req.params.id);
    if (!hotel) throw ApiError.notFound('That hotel does not exist.');

    const { checkIn, checkOut, guests = 1 } = req.query;
    if (!checkIn || !checkOut) throw ApiError.badRequest('checkIn and checkOut are required.');
    if (checkIn >= checkOut) throw ApiError.badRequest('Check-out must be after check-in.');

    res.json({ rooms: roomsWithAvailability(hotel, checkIn, checkOut, Number(guests) || 1) });
  })
);

// ------------------------------------------------------------------ reviews

router.post(
  '/:id/reviews',
  requireAuth,
  validate({ rating: 'required|int|min:1|max:5', title: 'required|string|max:80', comment: 'required|string|min:10|max:800' }),
  asyncHandler(async (req, res) => {
    const hotel = db.byId('hotels', req.params.id);
    if (!hotel) throw ApiError.notFound('That hotel does not exist.');

    // Only guests who actually completed a stay may review it.
    const stay = db.find(
      'bookings',
      (b) => b.userId === req.user.id && b.hotelId === hotel.id && b.status === BOOKING_STATUS.CHECKED_OUT
    );
    if (!stay) throw ApiError.forbidden('You can review a hotel after you have completed a stay there.');
    if (db.find('reviews', (r) => r.userId === req.user.id && r.hotelId === hotel.id)) {
      throw ApiError.conflict('You have already reviewed this hotel.');
    }

    const review = db.insert('reviews', {
      id: `rev_${Date.now().toString(36)}`,
      hotelId: hotel.id,
      userId: req.user.id,
      bookingId: stay.id,
      userName: req.user.name,
      rating: Number(req.body.rating),
      title: req.body.title.trim(),
      comment: req.body.comment.trim(),
      createdAt: new Date().toISOString(),
    });

    // Keep the denormalised hotel rating in step with its reviews.
    const all = db.all('reviews', (r) => r.hotelId === hotel.id);
    db.update('hotels', hotel.id, {
      rating: Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(2)),
      reviewsCount: hotel.reviewsCount + 1,
    });

    res.status(201).json({ review });
  })
);

// -------------------------------------------------------------- admin CRUD

const hotelSchema = {
  name: 'required|string|min:2|max:120',
  city: 'required|string|max:80',
  country: 'required|string|max:80',
  continent: 'required|string|max:40',
  category: 'required|in:luxury,resort,boutique,city,lodge',
  starRating: 'required|int|min:1|max:5',
  basePrice: 'required|number|min:20',
  description: 'required|string|min:20|max:800',
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents before slugging
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

router.post(
  '/',
  requireAuth,
  requireRole(ROLES.ADMIN),
  validate(hotelSchema),
  asyncHandler(async (req, res) => {
    const base = Number(req.body.basePrice);
    let slug = slugify(req.body.name);
    if (db.byId('hotels', slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const hotel = db.insert('hotels', {
      id: slug,
      slug,
      name: req.body.name.trim(),
      city: req.body.city.trim(),
      country: req.body.country.trim(),
      continent: req.body.continent.trim(),
      category: req.body.category,
      starRating: Number(req.body.starRating),
      rating: 0,
      reviewsCount: 0,
      basePrice: base,
      currency: 'USD',
      description: req.body.description.trim(),
      highlights: req.body.highlights || [],
      tags: req.body.tags || [],
      featured: Boolean(req.body.featured),
      amenities: req.body.amenities || ['Free WiFi', 'Room service'],
      images: ['a', 'b', 'c', 'd', 'e'].map(
        (s) => `https://picsum.photos/seed/${slug}-${s}/1600/1000`
      ),
      policies: {
        checkIn: '15:00', checkOut: '11:00',
        cancellation: 'Free cancellation up to 48 hours before check-in.',
        children: 'Children of all ages are welcome.',
      },
      rooms: [
        { id: `${slug}-deluxe`, key: 'deluxe', name: 'Deluxe Room', description: 'Comfortable room with a seating area.', price: base, capacity: 2, beds: '1 king bed', sizeSqm: 36, count: 20 },
        { id: `${slug}-executive`, key: 'executive', name: 'Executive Suite', description: 'Separate living room and upgraded amenities.', price: Math.round(base * 1.85), capacity: 3, beds: '1 king + sofa bed', sizeSqm: 62, count: 8 },
        { id: `${slug}-signature`, key: 'signature', name: 'Signature Suite', description: 'The best rooms in the house.', price: Math.round(base * 3.1), capacity: 4, beds: '2 king beds', sizeSqm: 110, count: 3 },
      ],
      active: true,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ hotel });
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const hotel = db.byId('hotels', req.params.id);
    if (!hotel) throw ApiError.notFound('That hotel does not exist.');

    const allowed = [
      'name', 'city', 'country', 'continent', 'category', 'starRating', 'basePrice',
      'description', 'highlights', 'tags', 'amenities', 'featured', 'active', 'images', 'policies',
    ];
    const patch = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    // Re-price the room tiers proportionally when the base rate changes.
    if (patch.basePrice && Number(patch.basePrice) !== hotel.basePrice) {
      const ratio = Number(patch.basePrice) / hotel.basePrice;
      patch.rooms = hotel.rooms.map((room) => ({ ...room, price: Math.round(room.price * ratio) }));
      patch.basePrice = Number(patch.basePrice);
    }

    res.json({ hotel: db.update('hotels', hotel.id, patch) });
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const hotel = db.byId('hotels', req.params.id);
    if (!hotel) throw ApiError.notFound('That hotel does not exist.');

    const live = db.all('bookings', (b) =>
      b.hotelId === hotel.id &&
      [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING, BOOKING_STATUS.CHECKED_IN].includes(b.status)
    );
    if (live.length > 0) {
      // Deactivating preserves history; a hard delete would orphan live stays.
      db.update('hotels', hotel.id, { active: false });
      return res.json({
        hotel: db.byId('hotels', hotel.id),
        message: `${live.length} active booking(s) — the hotel was deactivated instead of deleted.`,
      });
    }

    db.remove('hotels', hotel.id);
    return res.json({ ok: true, message: 'Hotel deleted.' });
  })
);

export default router;
