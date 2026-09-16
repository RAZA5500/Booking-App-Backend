import { Injectable } from '@nestjs/common';
import { BOOKING_STATUS } from '../config/configuration';
import { StoreService } from '../database/store.service';
import type { Booking, BookingStatusValue, Hotel, Room, RoomWithAvailability } from '../types/models';

const BLOCKING: BookingStatusValue[] = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
];

export interface AvailabilityOptions {
  excludeBookingId?: string;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly store: StoreService) {}

  /** Half-open intervals: a stay that ends the day another begins does not clash. */
  overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart < bEnd && bStart < aEnd;
  }

  bookingsForRoom(roomId: string, { excludeBookingId }: AvailabilityOptions = {}): Booking[] {
    return this.store.all(
      'bookings',
      (b) => b.roomId === roomId && BLOCKING.includes(b.status) && b.id !== excludeBookingId,
    );
  }

  /**
   * Rooms are inventory, not single units: a room type with `count: 24` can take
   * 24 concurrent stays. Availability is therefore "are all units taken on any
   * night of this range", computed as a peak-concurrency check.
   */
  unitsTakenOnRange(
    roomId: string,
    checkIn: string,
    checkOut: string,
    options?: AvailabilityOptions,
  ): number {
    return this.bookingsForRoom(roomId, options).filter((b) =>
      this.overlaps(checkIn, checkOut, b.checkIn, b.checkOut),
    ).length;
  }

  isRoomAvailable(
    room: Room,
    checkIn?: string,
    checkOut?: string,
    options?: AvailabilityOptions,
  ): boolean {
    if (!checkIn || !checkOut || checkIn >= checkOut) return false;
    return this.unitsTakenOnRange(room.id, checkIn, checkOut, options) < room.count;
  }

  roomsWithAvailability(
    hotel: Hotel,
    checkIn?: string,
    checkOut?: string,
    guests = 1,
  ): RoomWithAvailability[] {
    return hotel.rooms.map((room) => {
      const taken =
        checkIn && checkOut ? this.unitsTakenOnRange(room.id, checkIn, checkOut) : 0;
      const remaining = Math.max(0, room.count - taken);
      return {
        ...room,
        unitsLeft: remaining,
        available: Boolean(checkIn && checkOut) && remaining > 0 && room.capacity >= guests,
        fitsGuests: room.capacity >= guests,
      };
    });
  }

  hotelHasAvailability(hotel: Hotel, checkIn?: string, checkOut?: string, guests = 1): boolean {
    if (!checkIn || !checkOut) return true;
    return this.roomsWithAvailability(hotel, checkIn, checkOut, guests).some((r) => r.available);
  }

  /** Dates in the next `days` where every unit of every room type is taken. */
  soldOutDates(hotel: Hotel, days = 120): string[] {
    const blocked: string[] = [];
    const cursor = new Date();
    for (let i = 0; i < days; i++) {
      const day = new Date(cursor);
      day.setDate(day.getDate() + i);
      const iso = day.toISOString().slice(0, 10);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const nextIso = next.toISOString().slice(0, 10);

      const anyRoomFree = hotel.rooms.some(
        (room) => this.unitsTakenOnRange(room.id, iso, nextIso) < room.count,
      );
      if (!anyRoomFree) blocked.push(iso);
    }
    return blocked;
  }
}
