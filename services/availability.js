import { db } from '../db/store.js';
import { BOOKING_STATUS } from '../config.js';

const BLOCKING = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
];

// Half-open intervals: a stay that ends the day another begins does not clash.
export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export const bookingsForRoom = (roomId, { excludeBookingId } = {}) =>
  db.all('bookings', (b) =>
    b.roomId === roomId && BLOCKING.includes(b.status) && b.id !== excludeBookingId
  );

/**
 * Rooms are inventory, not single units: a room type with `count: 24` can take
 * 24 concurrent stays. Availability is therefore "are all units taken on any
 * night of this range", computed as a peak-concurrency check.
 */
export const unitsTakenOnRange = (roomId, checkIn, checkOut, options) =>
  bookingsForRoom(roomId, options).filter((b) => overlaps(checkIn, checkOut, b.checkIn, b.checkOut))
    .length;

export const isRoomAvailable = (room, checkIn, checkOut, options) => {
  if (!checkIn || !checkOut || checkIn >= checkOut) return false;
  return unitsTakenOnRange(room.id, checkIn, checkOut, options) < room.count;
};

export const roomsWithAvailability = (hotel, checkIn, checkOut, guests = 1) =>
  hotel.rooms.map((room) => {
    const taken = checkIn && checkOut ? unitsTakenOnRange(room.id, checkIn, checkOut) : 0;
    const remaining = Math.max(0, room.count - taken);
    return {
      ...room,
      unitsLeft: remaining,
      available: Boolean(checkIn && checkOut) && remaining > 0 && room.capacity >= guests,
      fitsGuests: room.capacity >= guests,
    };
  });

export const hotelHasAvailability = (hotel, checkIn, checkOut, guests = 1) => {
  if (!checkIn || !checkOut) return true;
  return roomsWithAvailability(hotel, checkIn, checkOut, guests).some((r) => r.available);
};

/** Dates in the next `days` where every unit of every room type is taken. */
export const soldOutDates = (hotel, days = 120) => {
  const blocked = [];
  const cursor = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(cursor);
    day.setDate(day.getDate() + i);
    const iso = day.toISOString().slice(0, 10);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const nextIso = next.toISOString().slice(0, 10);

    const anyRoomFree = hotel.rooms.some(
      (room) => unitsTakenOnRange(room.id, iso, nextIso) < room.count
    );
    if (!anyRoomFree) blocked.push(iso);
  }
  return blocked;
};
