import { Router } from 'express';
import { db } from '../db/store.js';
import { BOOKING_STATUS, ROLES } from '../config.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { canManageBooking, requireAuth, requireRole } from '../middleware/auth.js';
import { isRoomAvailable } from '../services/availability.js';
import { nightsBetween, quotePrice } from '../services/pricing.js';

const router = Router();

const today = () => new Date().toISOString().slice(0, 10);

const findRoom = (hotel, roomId) => hotel?.rooms.find((r) => r.id === roomId) || null;

const makeCode = () =>
  `SS${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

/** Which status transitions each role may perform. */
const TRANSITIONS = {
  [BOOKING_STATUS.PENDING]: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.CHECKED_IN, BOOKING_STATUS.CANCELLED],
  [BOOKING_STATUS.CHECKED_IN]: [BOOKING_STATUS.CHECKED_OUT],
  [BOOKING_STATUS.CHECKED_OUT]: [],
  [BOOKING_STATUS.CANCELLED]: [],
};

const withRelations = (booking) => {
  const hotel = db.byId('hotels', booking.hotelId);
  return {
    ...booking,
    hotel: hotel
      ? { id: hotel.id, name: hotel.name, city: hotel.city, country: hotel.country, images: hotel.images, starRating: hotel.starRating }
      : null,
  };
};

// --------------------------------------------------------------- price quote

router.get(
  '/quote',
  asyncHandler(async (req, res) => {
    const { hotelId, roomId, checkIn, checkOut } = req.query;
    const hotel = db.byId('hotels', hotelId);
    const room = findRoom(hotel, roomId);
    if (!room) throw ApiError.notFound('That room type does not exist.');
    if (!checkIn || !checkOut || checkIn >= checkOut) {
      throw ApiError.badRequest('Provide a check-in and a later check-out date.');
    }

    res.json({
      quote: quotePrice({ room, checkIn, checkOut }),
      available: isRoomAvailable(room, checkIn, checkOut),
    });
  })
);

// ------------------------------------------------------------------ listing

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { status, hotelId, q = '', from, to, page = 1, limit = 20, scope } = req.query;

    let rows = db.all('bookings');

    // Visibility is decided here and nowhere else.
    if (req.user.role === ROLES.CUSTOMER) {
      rows = rows.filter((b) => b.userId === req.user.id);
    } else if (req.user.role === ROLES.EMPLOYEE && req.user.hotelId) {
      rows = rows.filter((b) => b.hotelId === req.user.hotelId);
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
          .includes(needle)
      );
    }

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const total = rows.length;
    const perPage = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    res.json({
      bookings: rows.slice(start, start + perPage).map(withRelations),
      pagination: { total, page: currentPage, limit: perPage, pages: Math.max(1, Math.ceil(total / perPage)) },
    });
  })
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = db.byId('bookings', req.params.id) ||
      db.find('bookings', (b) => b.code === req.params.id);
    if (!booking) throw ApiError.notFound('That booking does not exist.');
    if (!canManageBooking(req.user, booking)) throw ApiError.forbidden('That booking is not yours.');

    res.json({ booking: withRelations(booking) });
  })
);

// ----------------------------------------------------------------- creation

router.post(
  '/',
  requireAuth,
  validate({
    hotelId: 'required|string',
    roomId: 'required|string',
    checkIn: 'required|date',
    checkOut: 'required|date',
    guests: 'required|int|min:1|max:10',
    guestName: 'required|string|min:2|max:80',
    guestEmail: 'required|email',
    guestPhone: 'string|max:32',
    note: 'string|max:400',
    paymentLast4: 'string|max:4',
  }),
  asyncHandler(async (req, res) => {
    const { hotelId, roomId, checkIn, checkOut, guests } = req.body;

    const hotel = db.byId('hotels', hotelId);
    if (!hotel || !hotel.active) throw ApiError.notFound('That hotel is not bookable.');

    const room = findRoom(hotel, roomId);
    if (!room) throw ApiError.notFound('That room type does not exist.');

    if (checkIn < today()) throw ApiError.badRequest('Check-in cannot be in the past.');
    if (checkIn >= checkOut) throw ApiError.badRequest('Check-out must be after check-in.');
    if (nightsBetween(checkIn, checkOut) > 30) {
      throw ApiError.badRequest('Stays longer than 30 nights need to be arranged with the hotel.');
    }
    if (Number(guests) > room.capacity) {
      throw ApiError.badRequest(`${room.name} sleeps up to ${room.capacity} guests.`);
    }
    if (!isRoomAvailable(room, checkIn, checkOut)) {
      throw ApiError.conflict('Those dates were just taken. Please choose another range.');
    }

    // Price is computed here, never accepted from the client.
    const pricing = quotePrice({ room, checkIn, checkOut });
    const now = new Date().toISOString();
    const status = BOOKING_STATUS.CONFIRMED;

    const booking = db.insert('bookings', {
      id: `bkg_${Date.now().toString(36)}`,
      code: makeCode(),
      userId: req.user.id,
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
        name: req.body.guestName.trim(),
        email: req.body.guestEmail.trim().toLowerCase(),
        phone: req.body.guestPhone?.trim() || null,
      },
      note: req.body.note?.trim() || '',
      paymentLast4: req.body.paymentLast4 || null,
      statusHistory: [{ status, at: now, by: req.user.id, note: 'Booked online' }],
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({ booking: withRelations(booking) });
  })
);

// ------------------------------------------------------------- modification

router.patch(
  '/:id/status',
  requireAuth,
  requireRole(ROLES.EMPLOYEE, ROLES.ADMIN),
  validate({ status: 'required|in:pending,confirmed,checked_in,checked_out,cancelled', note: 'string|max:300' }),
  asyncHandler(async (req, res) => {
    const booking = db.byId('bookings', req.params.id);
    if (!booking) throw ApiError.notFound('That booking does not exist.');
    if (!canManageBooking(req.user, booking)) {
      throw ApiError.forbidden('That booking belongs to a different hotel.');
    }

    const next = req.body.status;
    if (!TRANSITIONS[booking.status].includes(next)) {
      throw ApiError.badRequest(
        `A ${booking.status.replace('_', ' ')} booking cannot become ${next.replace('_', ' ')}.`
      );
    }

    const entry = { status: next, at: new Date().toISOString(), by: req.user.id, note: req.body.note || '' };
    const updated = db.update('bookings', booking.id, {
      status: next,
      statusHistory: [...booking.statusHistory, entry],
    });

    db.insert('audit', {
      id: `aud_${Date.now().toString(36)}`,
      actorId: req.user.id,
      actorName: req.user.name,
      action: `booking.${next}`,
      target: booking.id,
      at: entry.at,
    });

    res.json({ booking: withRelations(updated) });
  })
);

router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const booking = db.byId('bookings', req.params.id);
    if (!booking) throw ApiError.notFound('That booking does not exist.');
    if (!canManageBooking(req.user, booking)) throw ApiError.forbidden('That booking is not yours.');

    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(booking.status)) {
      throw ApiError.badRequest(`A ${booking.status.replace('_', ' ')} booking cannot be cancelled.`);
    }

    const entry = {
      status: BOOKING_STATUS.CANCELLED,
      at: new Date().toISOString(),
      by: req.user.id,
      note: req.body?.reason?.slice(0, 300) || 'Cancelled by guest',
    };

    res.json({
      booking: withRelations(
        db.update('bookings', booking.id, {
          status: BOOKING_STATUS.CANCELLED,
          statusHistory: [...booking.statusHistory, entry],
        })
      ),
    });
  })
);

router.patch(
  '/:id',
  requireAuth,
  validate({ checkIn: 'date', checkOut: 'date', guests: 'int|min:1|max:10', note: 'string|max:400' }),
  asyncHandler(async (req, res) => {
    const booking = db.byId('bookings', req.params.id);
    if (!booking) throw ApiError.notFound('That booking does not exist.');
    if (!canManageBooking(req.user, booking)) throw ApiError.forbidden('That booking is not yours.');
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw ApiError.badRequest('Only a confirmed booking that has not started can be changed.');
    }

    const checkIn = req.body.checkIn || booking.checkIn;
    const checkOut = req.body.checkOut || booking.checkOut;
    const guests = Number(req.body.guests || booking.guests);

    const hotel = db.byId('hotels', booking.hotelId);
    const room = findRoom(hotel, booking.roomId);
    if (!room) throw ApiError.notFound('That room type no longer exists.');

    if (checkIn < today()) throw ApiError.badRequest('Check-in cannot be in the past.');
    if (checkIn >= checkOut) throw ApiError.badRequest('Check-out must be after check-in.');
    if (guests > room.capacity) throw ApiError.badRequest(`${room.name} sleeps up to ${room.capacity} guests.`);

    // The booking's own dates must not count against its availability check.
    if (!isRoomAvailable(room, checkIn, checkOut, { excludeBookingId: booking.id })) {
      throw ApiError.conflict('That new range is not available.');
    }

    const pricing = quotePrice({ room, checkIn, checkOut });
    const updated = db.update('bookings', booking.id, {
      checkIn,
      checkOut,
      guests,
      nights: pricing.nights,
      pricing,
      note: req.body.note ?? booking.note,
      statusHistory: [
        ...booking.statusHistory,
        { status: booking.status, at: new Date().toISOString(), by: req.user.id, note: 'Dates changed' },
      ],
    });

    res.json({ booking: withRelations(updated) });
  })
);

export default router;
