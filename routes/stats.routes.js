import { Router } from 'express';
import { db } from '../db/store.js';
import { BOOKING_STATUS, ROLES } from '../config.js';
import { asyncHandler } from '../middleware/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const today = () => new Date().toISOString().slice(0, 10);
const revenueOf = (rows) =>
  rows.filter((b) => b.status !== BOOKING_STATUS.CANCELLED)
    .reduce((sum, b) => sum + b.pricing.total, 0);

const monthKey = (iso) => iso.slice(0, 7);

const lastMonths = (count) => {
  const months = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - i);
    months.push({
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
    });
  }
  return months;
};

router.get(
  '/admin',
  requireRole(ROLES.ADMIN),
  asyncHandler(async (_req, res) => {
    const bookings = db.all('bookings');
    const hotels = db.all('hotels');
    const users = db.all('users');
    const live = bookings.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);

    const trend = lastMonths(8).map(({ key, label }) => {
      const rows = live.filter((b) => monthKey(b.checkIn) === key);
      return { month: label, bookings: rows.length, revenue: revenueOf(rows) };
    });

    const byHotel = hotels
      .map((hotel) => {
        const rows = live.filter((b) => b.hotelId === hotel.id);
        return {
          id: hotel.id,
          name: hotel.name,
          city: hotel.city,
          bookings: rows.length,
          revenue: revenueOf(rows),
          nights: rows.reduce((s, b) => s + b.nights, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const byContinent = Object.entries(
      live.reduce((acc, b) => {
        const hotel = db.byId('hotels', b.hotelId);
        const key = hotel?.continent || 'Unknown';
        acc[key] = (acc[key] || 0) + b.pricing.total;
        return acc;
      }, {})
    ).map(([name, revenue]) => ({ name, revenue }));

    const totalRoomNights = hotels.reduce(
      (sum, h) => sum + h.rooms.reduce((s, r) => s + r.count, 0) * 30,
      0
    );
    const soldNights = live
      .filter((b) => b.checkIn >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .reduce((s, b) => s + b.nights, 0);

    res.json({
      totals: {
        revenue: revenueOf(bookings),
        bookings: bookings.length,
        activeBookings: bookings.filter((b) =>
          [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN].includes(b.status)
        ).length,
        cancelled: bookings.filter((b) => b.status === BOOKING_STATUS.CANCELLED).length,
        hotels: hotels.length,
        activeHotels: hotels.filter((h) => h.active).length,
        users: users.length,
        customers: users.filter((u) => u.role === ROLES.CUSTOMER).length,
        staff: users.filter((u) => u.role !== ROLES.CUSTOMER).length,
        averageNightly: live.length
          ? Math.round(live.reduce((s, b) => s + b.pricing.nightlyRate, 0) / live.length)
          : 0,
        occupancy: totalRoomNights ? Number(((soldNights / totalRoomNights) * 100).toFixed(1)) : 0,
      },
      trend,
      topHotels: byHotel.slice(0, 6),
      byContinent,
      statusBreakdown: Object.values(BOOKING_STATUS).map((status) => ({
        status,
        count: bookings.filter((b) => b.status === status).length,
      })),
      recentBookings: [...bookings]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8),
      audit: db.all('audit').slice(-10).reverse(),
    });
  })
);

router.get(
  '/employee',
  requireRole(ROLES.EMPLOYEE, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const scopeHotel = req.user.role === ROLES.EMPLOYEE ? req.user.hotelId : req.query.hotelId || null;
    const rows = scopeHotel ? db.all('bookings', (b) => b.hotelId === scopeHotel) : db.all('bookings');
    const hotel = scopeHotel ? db.byId('hotels', scopeHotel) : null;
    const day = today();

    const arrivals = rows.filter(
      (b) => b.checkIn === day && [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING].includes(b.status)
    );
    const departures = rows.filter(
      (b) => b.checkOut === day && b.status === BOOKING_STATUS.CHECKED_IN
    );
    const inHouse = rows.filter((b) => b.status === BOOKING_STATUS.CHECKED_IN);

    const capacity = hotel ? hotel.rooms.reduce((s, r) => s + r.count, 0) : 0;

    res.json({
      hotel: hotel ? { id: hotel.id, name: hotel.name, city: hotel.city, country: hotel.country } : null,
      today: day,
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
        upcoming: rows.filter((b) => b.checkIn > day && b.status === BOOKING_STATUS.CONFIRMED).length,
        occupancy: capacity ? Number(((inHouse.length / capacity) * 100).toFixed(1)) : 0,
        revenueToday: revenueOf(rows.filter((b) => b.checkIn === day)),
      },
      arrivals,
      departures,
      inHouse,
    });
  })
);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const rows = db.all('bookings', (b) => b.userId === req.user.id);
    const live = rows.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);
    const day = today();

    res.json({
      counts: {
        trips: live.length,
        upcoming: live.filter((b) => b.checkIn >= day && b.status !== BOOKING_STATUS.CHECKED_OUT).length,
        nights: live.reduce((s, b) => s + b.nights, 0),
        spend: revenueOf(rows),
        countries: new Set(
          live.map((b) => db.byId('hotels', b.hotelId)?.country).filter(Boolean)
        ).size,
        saved: db.all('favorites', (f) => f.userId === req.user.id).length,
      },
    });
  })
);

export default router;
