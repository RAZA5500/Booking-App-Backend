import bcrypt from 'bcryptjs';
import { db, load } from './store.js';
import { HOTELS } from '../data/hotels.seed.js';
import { BOOKING_STATUS, ROLES, config } from '../config.js';
import { quotePrice } from '../services/pricing.js';

// Deterministic PRNG so a reseed produces the same demo dataset every time.
const rng = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const DEMO_ACCOUNTS = [
  {
    email: 'admin@stayscape.com', password: 'Admin@123', role: ROLES.ADMIN,
    name: 'Amara Osei', phone: '+1 202 555 0142',
  },
  {
    email: 'employee@stayscape.com', password: 'Employee@123', role: ROLES.EMPLOYEE,
    name: 'Diego Marchetti', phone: '+39 06 555 0188', hotelId: 'ritz-paris',
  },
  {
    email: 'customer@stayscape.com', password: 'Customer@123', role: ROLES.CUSTOMER,
    name: 'Priya Raman', phone: '+44 20 7946 0321',
  },
];

const EXTRA_CUSTOMERS = [
  'Lukas Weber', 'Chen Wei', 'Sofia Almeida', 'Noah Fitzgerald', 'Yuki Tanaka',
  'Isabella Rossi', 'Omar Haddad', 'Grace Mwangi', 'Elena Petrova', 'Mateo Ibarra',
  'Hannah Kim', 'Tom Okafor',
];

const REVIEW_LINES = [
  ['Worth every cent', 'The service set a standard I will be measuring other hotels against for years.'],
  ['Faultless stay', 'Check-in took two minutes, the room was ready early, and nothing was too much trouble.'],
  ['Beautiful, slightly formal', 'Stunning building and grounds. The restaurant is a touch stiff for a family trip.'],
  ['The view alone', 'We upgraded on arrival and I would do it again without hesitating. Wake up early for sunrise.'],
  ['Great, with one caveat', 'Everything was excellent except the WiFi, which dropped a few times in the evening.'],
  ['Came back for a third time', 'Staff remembered our names from last year. That is why we keep returning.'],
];

export const seedIfEmpty = ({ force = false } = {}) => {
  const data = load();
  if (!force && data.users.length > 0) {
    return { seeded: false, users: data.users.length, hotels: data.hotels.length };
  }

  const random = rng(20260912);
  const now = new Date().toISOString();

  // ---------------------------------------------------------------- users
  const users = DEMO_ACCOUNTS.map((account, index) => ({
    id: `usr_${String(index + 1).padStart(4, '0')}`,
    name: account.name,
    email: account.email,
    passwordHash: bcrypt.hashSync(account.password, config.bcryptRounds),
    role: account.role,
    phone: account.phone,
    hotelId: account.hotelId || null,
    avatarSeed: account.name.split(' ')[0].toLowerCase(),
    active: true,
    createdAt: now,
    lastLoginAt: null,
  }));

  EXTRA_CUSTOMERS.forEach((name) => {
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
    users.push({
      id: `usr_${String(users.length + 1).padStart(4, '0')}`,
      name,
      email: `${slug}@example.com`,
      passwordHash: bcrypt.hashSync('Password@123', config.bcryptRounds),
      role: ROLES.CUSTOMER,
      phone: null,
      hotelId: null,
      avatarSeed: slug.split('.')[0],
      active: true,
      createdAt: now,
      lastLoginAt: null,
    });
  });

  // One more employee so the admin user table shows a realistic mix.
  users.push({
    id: `usr_${String(users.length + 1).padStart(4, '0')}`,
    name: 'Aiko Sato',
    email: 'aiko.sato@stayscape.com',
    passwordHash: bcrypt.hashSync('Employee@123', config.bcryptRounds),
    role: ROLES.EMPLOYEE,
    phone: '+81 3 5555 0110',
    hotelId: 'aman-tokyo',
    avatarSeed: 'aiko',
    active: true,
    createdAt: now,
    lastLoginAt: null,
  });

  // ------------------------------------------------------------- bookings
  const customers = users.filter((u) => u.role === ROLES.CUSTOMER);
  const bookings = [];
  const reviews = [];

  // A spread of past, in-house and future stays so every dashboard has data.
  const plan = [
    ...Array.from({ length: 26 }, () => 'past'),
    ...Array.from({ length: 4 }, () => 'current'),
    ...Array.from({ length: 22 }, () => 'future'),
    ...Array.from({ length: 5 }, () => 'cancelled'),
  ];

  plan.forEach((kind) => {
    const hotel = HOTELS[Math.floor(random() * HOTELS.length)];
    const room = hotel.rooms[Math.floor(random() * hotel.rooms.length)];
    const customer = customers[Math.floor(random() * customers.length)];
    const nights = 1 + Math.floor(random() * 6);

    let start;
    if (kind === 'past') start = -(7 + Math.floor(random() * 150));
    else if (kind === 'current') start = -Math.floor(random() * 2) - 1;
    else start = 2 + Math.floor(random() * 90);

    const checkIn = iso(start);
    const checkOut = iso(start + nights);
    const guests = 1 + Math.floor(random() * Math.min(room.capacity, 4));
    const pricing = quotePrice({ room, checkIn, checkOut });

    let status = BOOKING_STATUS.CONFIRMED;
    if (kind === 'past') status = BOOKING_STATUS.CHECKED_OUT;
    if (kind === 'current') status = BOOKING_STATUS.CHECKED_IN;
    if (kind === 'cancelled') status = BOOKING_STATUS.CANCELLED;

    const createdAt = new Date(Date.now() - (200 - bookings.length) * 3600_000).toISOString();

    const booking = {
      id: `bkg_${String(bookings.length + 1).padStart(4, '0')}`,
      code: `SS${(100000 + bookings.length * 137).toString(36).toUpperCase().slice(0, 6)}`,
      userId: customer.id,
      hotelId: hotel.id,
      roomId: room.id,
      roomName: room.name,
      hotelName: hotel.name,
      checkIn,
      checkOut,
      nights,
      guests,
      pricing,
      status,
      guest: { name: customer.name, email: customer.email, phone: customer.phone },
      note: '',
      paymentLast4: String(4000 + Math.floor(random() * 5999)).slice(-4),
      statusHistory: [{ status, at: createdAt, by: 'system', note: 'Seeded record' }],
      createdAt,
      updatedAt: createdAt,
    };
    bookings.push(booking);

    // Roughly two thirds of completed stays leave a review.
    if (status === BOOKING_STATUS.CHECKED_OUT && random() > 0.35) {
      const [title, comment] = REVIEW_LINES[Math.floor(random() * REVIEW_LINES.length)];
      reviews.push({
        id: `rev_${String(reviews.length + 1).padStart(4, '0')}`,
        hotelId: hotel.id,
        userId: customer.id,
        bookingId: booking.id,
        userName: customer.name,
        rating: 3 + Math.floor(random() * 3),
        title,
        comment,
        createdAt: new Date(Date.parse(checkOut) + 86400000).toISOString(),
      });
    }
  });

  // The two staffed hotels get a realistic front-desk day — arrivals due,
  // guests in house and departures — so an employee signing in to the demo
  // lands on a dashboard with work on it rather than an empty state.
  const deskDay = (hotelId) => {
    const hotel = HOTELS.find((h) => h.id === hotelId);
    const shifts = [
      ...Array.from({ length: 3 }, () => ({ start: 0, nights: 2 + Math.floor(random() * 3), status: BOOKING_STATUS.CONFIRMED })),
      ...Array.from({ length: 3 }, () => ({ start: -1 - Math.floor(random() * 2), nights: 4, status: BOOKING_STATUS.CHECKED_IN })),
      ...Array.from({ length: 2 }, () => ({ start: -2, nights: 2, status: BOOKING_STATUS.CHECKED_IN })),
      ...Array.from({ length: 4 }, () => ({ start: 1 + Math.floor(random() * 5), nights: 3, status: BOOKING_STATUS.CONFIRMED })),
    ];

    shifts.forEach((shift) => {
      const room = hotel.rooms[Math.floor(random() * hotel.rooms.length)];
      const customer = customers[Math.floor(random() * customers.length)];
      const checkIn = iso(shift.start);
      const checkOut = iso(shift.start + shift.nights);
      const pricing = quotePrice({ room, checkIn, checkOut });
      const index = bookings.length;
      const createdAt = new Date(Date.now() - index * 1800_000).toISOString();

      bookings.push({
        id: `bkg_${String(index + 1).padStart(4, '0')}`,
        code: `SS${(200000 + index * 91).toString(36).toUpperCase().slice(0, 6)}`,
        userId: customer.id,
        hotelId: hotel.id,
        roomId: room.id,
        roomName: room.name,
        hotelName: hotel.name,
        checkIn,
        checkOut,
        nights: pricing.nights,
        guests: 1 + Math.floor(random() * Math.min(room.capacity, 3)),
        pricing,
        status: shift.status,
        guest: { name: customer.name, email: customer.email, phone: customer.phone },
        note: '',
        paymentLast4: String(4000 + Math.floor(random() * 5999)).slice(-4),
        statusHistory: [{ status: shift.status, at: createdAt, by: 'system', note: 'Seeded record' }],
        createdAt,
        updatedAt: createdAt,
      });
    });
  };

  deskDay('ritz-paris');
  deskDay('aman-tokyo');

  // Sell out one famous hotel completely for a week, so the availability
  // calendar has real struck-out nights and the search filter has something to
  // exclude rather than always returning everything.
  const soldOut = (hotelId, startOffset, nights) => {
    const hotel = HOTELS.find((h) => h.id === hotelId);
    const checkIn = iso(startOffset);
    const checkOut = iso(startOffset + nights);

    hotel.rooms.forEach((room) => {
      for (let unit = 0; unit < room.count; unit++) {
        const customer = customers[Math.floor(random() * customers.length)];
        const pricing = quotePrice({ room, checkIn, checkOut });
        const index = bookings.length;
        const createdAt = new Date(Date.now() - index * 900_000).toISOString();

        bookings.push({
          id: `bkg_${String(index + 1).padStart(4, '0')}`,
          code: `SS${(300000 + index * 53).toString(36).toUpperCase().slice(0, 6)}`,
          userId: customer.id,
          hotelId: hotel.id,
          roomId: room.id,
          roomName: room.name,
          hotelName: hotel.name,
          checkIn,
          checkOut,
          nights: pricing.nights,
          guests: Math.min(2, room.capacity),
          pricing,
          status: BOOKING_STATUS.CONFIRMED,
          guest: { name: customer.name, email: customer.email, phone: customer.phone },
          note: '',
          paymentLast4: String(4000 + Math.floor(random() * 5999)).slice(-4),
          statusHistory: [{ status: BOOKING_STATUS.CONFIRMED, at: createdAt, by: 'system', note: 'Seeded record' }],
          createdAt,
          updatedAt: createdAt,
        });
      }
    });
  };

  soldOut('soneva-fushi-maldives', 21, 7);
  soldOut('burj-al-arab-dubai', 30, 4);

  const favorites = customers.slice(0, 6).flatMap((customer, i) =>
    HOTELS.slice(i * 2, i * 2 + 2).map((h) => ({
      id: `fav_${customer.id}_${h.id}`,
      userId: customer.id,
      hotelId: h.id,
      createdAt: now,
    }))
  );

  db.replaceAll('users', users);
  db.replaceAll('hotels', structuredClone(HOTELS));
  db.replaceAll('bookings', bookings);
  db.replaceAll('reviews', reviews);
  db.replaceAll('favorites', favorites);
  db.replaceAll('audit', []);

  return { seeded: true, users: users.length, hotels: HOTELS.length, bookings: bookings.length };
};
