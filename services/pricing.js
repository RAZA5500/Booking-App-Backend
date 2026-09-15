import { config } from '../config.js';

export const nightsBetween = (checkIn, checkOut) => {
  const ms = Date.parse(`${checkOut}T12:00:00`) - Date.parse(`${checkIn}T12:00:00`);
  return Math.max(0, Math.round(ms / 86400000));
};

// The single source of truth for money. The client renders this breakdown but
// never sends a total — the server recomputes it on every booking.
export const quotePrice = ({ room, checkIn, checkOut }) => {
  const nights = nightsBetween(checkIn, checkOut);
  const roomTotal = room.price * nights;
  const discount = nights >= 7 ? Math.round(roomTotal * config.weeklyDiscountRate) : 0;
  const discounted = roomTotal - discount;
  const cleaning = nights > 0 ? config.cleaningFee : 0;
  const service = Math.round(discounted * config.serviceFeeRate);
  const tax = Math.round(discounted * config.taxRate);

  return {
    nights,
    nightlyRate: room.price,
    roomTotal,
    discount,
    cleaning,
    service,
    tax,
    total: discounted + cleaning + service + tax,
    currency: 'USD',
  };
};
