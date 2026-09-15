import { seedIfEmpty } from '../db/seed.js';

const summary = seedIfEmpty({ force: true });
console.log(
  `Reseeded: ${summary.hotels} hotels, ${summary.users} users, ${summary.bookings} bookings.`
);
