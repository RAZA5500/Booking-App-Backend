import { Injectable } from '@nestjs/common';
import { BOOKING_STATUS, ROLES } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import type { Booking, User } from '../../types/models';

const today = (): string => new Date().toISOString().slice(0, 10);

const monthKey = (iso: string): string => iso.slice(0, 7);

const lastMonths = (count: number) => {
  const months: Array<{ key: string; label: string }> = [];
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

@Injectable()
export class StatsService {
  constructor(private readonly store: StoreService) {}

  /** Cancelled stays never count toward revenue. */
  private revenueOf(rows: Booking[]): number {
    return rows
      .filter((b) => b.status !== BOOKING_STATUS.CANCELLED)
      .reduce((sum, b) => sum + b.pricing.total, 0);
  }

  admin() {
    const bookings = this.store.all('bookings');
    const hotels = this.store.all('hotels');
    const users = this.store.all('users');
    const live = bookings.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);

    const trend = lastMonths(8).map(({ key, label }) => {
      const rows = live.filter((b) => monthKey(b.checkIn) === key);
      return { month: label, bookings: rows.length, revenue: this.revenueOf(rows) };
    });

    const byHotel = hotels
      .map((hotel) => {
        const rows = live.filter((b) => b.hotelId === hotel.id);
        return {
          id: hotel.id,
          name: hotel.name,
          city: hotel.city,
          bookings: rows.length,
          revenue: this.revenueOf(rows),
          nights: rows.reduce((s, b) => s + b.nights, 0),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const byContinent = Object.entries(
      live.reduce<Record<string, number>>((acc, b) => {
        const hotel = this.store.byId('hotels', b.hotelId);
        const key = hotel?.continent || 'Unknown';
        acc[key] = (acc[key] || 0) + b.pricing.total;
        return acc;
      }, {}),
    ).map(([name, revenue]) => ({ name, revenue }));

    const totalRoomNights = hotels.reduce(
      (sum, h) => sum + h.rooms.reduce((s, r) => s + r.count, 0) * 30,
      0,
    );
    const soldNights = live
      .filter((b) => b.checkIn >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
      .reduce((s, b) => s + b.nights, 0);

    return {
      totals: {
        revenue: this.revenueOf(bookings),
        bookings: bookings.length,
        activeBookings: bookings.filter((b) =>
          [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.CHECKED_IN].includes(b.status),
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
        occupancy: totalRoomNights
          ? Number(((soldNights / totalRoomNights) * 100).toFixed(1))
          : 0,
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
      audit: this.store.all('audit').slice(-10).reverse(),
    };
  }

  employee(user: User, hotelIdFilter?: string) {
    const scopeHotel = user.role === ROLES.EMPLOYEE ? user.hotelId : hotelIdFilter || null;
    const rows = scopeHotel
      ? this.store.all('bookings', (b) => b.hotelId === scopeHotel)
      : this.store.all('bookings');
    const hotel = scopeHotel ? this.store.byId('hotels', scopeHotel) : null;
    const day = today();

    const arrivals = rows.filter(
      (b) =>
        b.checkIn === day &&
        [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.PENDING].includes(b.status),
    );
    const departures = rows.filter(
      (b) => b.checkOut === day && b.status === BOOKING_STATUS.CHECKED_IN,
    );
    const inHouse = rows.filter((b) => b.status === BOOKING_STATUS.CHECKED_IN);

    const capacity = hotel ? hotel.rooms.reduce((s, r) => s + r.count, 0) : 0;

    return {
      hotel: hotel
        ? { id: hotel.id, name: hotel.name, city: hotel.city, country: hotel.country }
        : null,
      today: day,
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
        upcoming: rows.filter((b) => b.checkIn > day && b.status === BOOKING_STATUS.CONFIRMED)
          .length,
        occupancy: capacity ? Number(((inHouse.length / capacity) * 100).toFixed(1)) : 0,
        revenueToday: this.revenueOf(rows.filter((b) => b.checkIn === day)),
      },
      arrivals,
      departures,
      inHouse,
    };
  }

  forUser(user: User) {
    const rows = this.store.all('bookings', (b) => b.userId === user.id);
    const live = rows.filter((b) => b.status !== BOOKING_STATUS.CANCELLED);
    const day = today();

    return {
      counts: {
        trips: live.length,
        upcoming: live.filter(
          (b) => b.checkIn >= day && b.status !== BOOKING_STATUS.CHECKED_OUT,
        ).length,
        nights: live.reduce((s, b) => s + b.nights, 0),
        spend: this.revenueOf(rows),
        countries: new Set(
          live.map((b) => this.store.byId('hotels', b.hotelId)?.country).filter(Boolean),
        ).size,
        saved: this.store.all('favorites', (f) => f.userId === user.id).length,
      },
    };
  }
}
