import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/api-exception';
import { BOOKING_STATUS, ROLES } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import { AvailabilityService } from '../../domain/availability.service';
import { PricingService } from '../../domain/pricing.service';
import type { Booking, BookingStatusValue, Hotel, Room, User } from '../../types/models';
import {
  BookingListQuery,
  CancelBookingDto,
  CreateBookingDto,
  QuoteQuery,
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';

const today = (): string => new Date().toISOString().slice(0, 10);

const makeCode = (): string => `SS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const findRoom = (hotel: Hotel | null, roomId: string | undefined): Room | null =>
  hotel?.rooms.find((r) => r.id === roomId) || null;

/** Which status transitions are legal from each state. */
const TRANSITIONS: Record<BookingStatusValue, BookingStatusValue[]> = {
  pending: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  confirmed: [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CANCELLED],
  checked_in: [BOOKING_STATUS.CHECKED_OUT],
  checked_out: [],
  cancelled: [],
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly store: StoreService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
  ) {}

  /**
   * Staff may only touch bookings for the hotel they are assigned to. Admins are
   * unscoped. Guests see their own.
   */
  private canManage(user: User | undefined, booking: Booking): boolean {
    if (!user) return false;
    if (user.role === ROLES.ADMIN) return true;
    if (user.role === ROLES.EMPLOYEE) return !user.hotelId || user.hotelId === booking.hotelId;
    return booking.userId === user.id;
  }

  private withRelations(booking: Booking) {
    const hotel = this.store.byId('hotels', booking.hotelId);
    return {
      ...booking,
      hotel: hotel
        ? {
            id: hotel.id,
            name: hotel.name,
            city: hotel.city,
            country: hotel.country,
            images: hotel.images,
            starRating: hotel.starRating,
          }
        : null,
    };
  }

  // --------------------------------------------------------------- price quote

  quote(query: QuoteQuery) {
    const { hotelId, roomId, checkIn, checkOut } = query;
    const hotel = this.store.byId('hotels', hotelId);
    const room = findRoom(hotel, roomId);
    if (!room) throw ApiException.notFound('That room type does not exist.');
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      throw ApiException.badRequest('Provide a check-in and a later check-out date.');
    }

    return {
      quote: this.pricing.quote({ room, checkIn, checkOut }),
      available: this.availability.isRoomAvailable(room, checkIn, checkOut),
    };
  }

  // ------------------------------------------------------------------ listing

  list(query: BookingListQuery, user: User) {
    const { status, hotelId, q = '', from, to, page = '1', limit = '20', scope } = query;

    let rows = this.store.all('bookings');

    // Visibility is decided here and nowhere else.
    if (user.role === ROLES.CUSTOMER) {
      rows = rows.filter((b) => b.userId === user.id);
    } else if (user.role === ROLES.EMPLOYEE && user.hotelId) {
      rows = rows.filter((b) => b.hotelId === user.hotelId);
    }

    if (status) rows = rows.filter((b) => String(status).split(',').includes(b.status));
    if (hotelId) rows = rows.filter((b) => b.hotelId === hotelId);
    if (from) rows = rows.filter((b) => b.checkOut >= from);
    if (to) rows = rows.filter((b) => b.checkIn <= to);

    if (scope === 'arrivals') rows = rows.filter((b) => b.checkIn === today());
    if (scope === 'departures') rows = rows.filter((b) => b.checkOut === today());
    if (scope === 'in-house') rows = rows.filter((b) => b.status === BOOKING_STATUS.CHECKED_IN);

    const needle = String(q).trim().toLowerCase();
    if (needle) {
      rows = rows.filter((b) =>
        `${b.code} ${b.guest.name} ${b.guest.email} ${b.hotelName} ${b.roomName}`
          .toLowerCase()
          .includes(needle),
      );
    }

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = rows.length;
    const perPage = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    return {
      bookings: rows.slice(start, start + perPage).map((b) => this.withRelations(b)),
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        pages: Math.max(1, Math.ceil(total / perPage)),
      },
    };
  }

  /** Accepts either the internal id or the guest-facing booking code. */
  findOne(idOrCode: string, user: User) {
    const booking =
      this.store.byId('bookings', idOrCode) ||
      this.store.find('bookings', (b) => b.code === idOrCode);
    if (!booking) throw ApiException.notFound('That booking does not exist.');
    if (!this.canManage(user, booking)) throw ApiException.forbidden('That booking is not yours.');

    return { booking: this.withRelations(booking) };
  }

  // ----------------------------------------------------------------- creation

  create(dto: CreateBookingDto, user: User) {
    const { hotelId, roomId, checkIn, checkOut, guests } = dto;

    const hotel = this.store.byId('hotels', hotelId);
    if (!hotel || !hotel.active) throw ApiException.notFound('That hotel is not bookable.');

    const room = findRoom(hotel, roomId);
    if (!room) throw ApiException.notFound('That room type does not exist.');

    if (checkIn < today()) throw ApiException.badRequest('Check-in cannot be in the past.');
    if (checkIn >= checkOut) throw ApiException.badRequest('Check-out must be after check-in.');
    if (this.pricing.nightsBetween(checkIn, checkOut) > 30) {
      throw ApiException.badRequest(
        'Stays longer than 30 nights need to be arranged with the hotel.',
      );
    }
    if (Number(guests) > room.capacity) {
      throw ApiException.badRequest(`${room.name} sleeps up to ${room.capacity} guests.`);
    }
    if (!this.availability.isRoomAvailable(room, checkIn, checkOut)) {
      throw ApiException.conflict('Those dates were just taken. Please choose another range.');
    }

    // Price is computed here, never accepted from the client.
    const pricing = this.pricing.quote({ room, checkIn, checkOut });
    const now = new Date().toISOString();
    const status = BOOKING_STATUS.CONFIRMED;

    const booking = this.store.insert('bookings', {
      id: `bkg_${Date.now().toString(36)}`,
      code: makeCode(),
      userId: user.id,
      hotelId: hotel.id,
      hotelName: hotel.name,
      roomId: room.id,
      roomName: room.name,
      checkIn,
      checkOut,
      nights: pricing.nights,
      guests: Number(guests),
      pricing,
      status,
      guest: {
        name: dto.guestName.trim(),
        email: dto.guestEmail.trim().toLowerCase(),
        phone: dto.guestPhone?.trim() || null,
      },
      note: dto.note?.trim() || '',
      paymentLast4: dto.paymentLast4 || null,
      statusHistory: [{ status, at: now, by: user.id, note: 'Booked online' }],
      createdAt: now,
      updatedAt: now,
    });

    return { booking: this.withRelations(booking) };
  }

  // ------------------------------------------------------------- modification

  setStatus(id: string, dto: UpdateBookingStatusDto, user: User) {
    const booking = this.store.byId('bookings', id);
    if (!booking) throw ApiException.notFound('That booking does not exist.');
    if (!this.canManage(user, booking)) {
      throw ApiException.forbidden('That booking belongs to a different hotel.');
    }

    const next = dto.status;
    if (!TRANSITIONS[booking.status].includes(next)) {
      throw ApiException.badRequest(
        `A ${booking.status.replace('_', ' ')} booking cannot become ${next.replace('_', ' ')}.`,
      );
    }

    const entry = {
      status: next,
      at: new Date().toISOString(),
      by: user.id,
      note: dto.note || '',
    };
    const updated = this.store.update('bookings', booking.id, {
      status: next,
      statusHistory: [...booking.statusHistory, entry],
    }) as Booking;

    this.store.insert('audit', {
      id: `aud_${Date.now().toString(36)}`,
      actorId: user.id,
      actorName: user.name,
      action: `booking.${next}`,
      target: booking.id,
      at: entry.at,
    });

    return { booking: this.withRelations(updated) };
  }

  cancel(id: string, dto: CancelBookingDto, user: User) {
    const booking = this.store.byId('bookings', id);
    if (!booking) throw ApiException.notFound('That booking does not exist.');
    if (!this.canManage(user, booking)) throw ApiException.forbidden('That booking is not yours.');

    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status)) {
      throw ApiException.badRequest(
        `A ${booking.status.replace('_', ' ')} booking cannot be cancelled.`,
      );
    }

    const entry = {
      status: BOOKING_STATUS.CANCELLED,
      at: new Date().toISOString(),
      by: user.id,
      note: dto?.reason?.slice(0, 300) || 'Cancelled by guest',
    };

    const updated = this.store.update('bookings', booking.id, {
      status: BOOKING_STATUS.CANCELLED,
      statusHistory: [...booking.statusHistory, entry],
    }) as Booking;

    return { booking: this.withRelations(updated) };
  }

  update(id: string, dto: UpdateBookingDto, user: User) {
    const booking = this.store.byId('bookings', id);
    if (!booking) throw ApiException.notFound('That booking does not exist.');
    if (!this.canManage(user, booking)) throw ApiException.forbidden('That booking is not yours.');
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw ApiException.badRequest('Only a confirmed booking that has not started can be changed.');
    }

    const checkIn = dto.checkIn || booking.checkIn;
    const checkOut = dto.checkOut || booking.checkOut;
    const guests = Number(dto.guests || booking.guests);

    const hotel = this.store.byId('hotels', booking.hotelId);
    const room = findRoom(hotel, booking.roomId);
    if (!room) throw ApiException.notFound('That room type no longer exists.');

    if (checkIn < today()) throw ApiException.badRequest('Check-in cannot be in the past.');
    if (checkIn >= checkOut) throw ApiException.badRequest('Check-out must be after check-in.');
    if (guests > room.capacity) {
      throw ApiException.badRequest(`${room.name} sleeps up to ${room.capacity} guests.`);
    }

    // The booking's own dates must not count against its availability check.
    if (
      !this.availability.isRoomAvailable(room, checkIn, checkOut, { excludeBookingId: booking.id })
    ) {
      throw ApiException.conflict('That new range is not available.');
    }

    const pricing = this.pricing.quote({ room, checkIn, checkOut });
    const updated = this.store.update('bookings', booking.id, {
      checkIn,
      checkOut,
      guests,
      nights: pricing.nights,
      pricing,
      note: dto.note ?? booking.note,
      statusHistory: [
        ...booking.statusHistory,
        {
          status: booking.status,
          at: new Date().toISOString(),
          by: user.id,
          note: 'Dates changed',
        },
      ],
    }) as Booking;

    return { booking: this.withRelations(updated) };
  }
}
