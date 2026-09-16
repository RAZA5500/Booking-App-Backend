import * as path from 'node:path';
import type { BookingStatusValue, Role } from '../types/models';

const required = (name: string, fallback: string): string => {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  // Dev-only fallback so the app runs straight after clone. Never ships to prod:
  // NODE_ENV=production makes the missing variable fatal above.
  return fallback;
};

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  isProd: process.env.NODE_ENV === 'production',

  // `__dirname` is api/dist/config once compiled, so the data file resolves
  // relative to the package root either way.
  dataFile: process.env.DATA_FILE || path.join(__dirname, '..', '..', 'db', 'data.json'),

  accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  accessTtl: '15m',
  refreshTtl: '7d',
  refreshCookie: 'stayscape_rt',
  refreshCookieMaxAge: 7 * 24 * 60 * 60 * 1000,

  bcryptRounds: 10,

  // Fees applied on top of the room rate, kept server-side so a client cannot
  // talk the total down.
  cleaningFee: 45,
  serviceFeeRate: 0.11,
  taxRate: 0.09,
  weeklyDiscountRate: 0.1,
} as const;

export const ROLES: Record<'CUSTOMER' | 'EMPLOYEE' | 'ADMIN', Role> = {
  CUSTOMER: 'customer',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
};

export const BOOKING_STATUS: Record<
  'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED',
  BookingStatusValue
> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  CANCELLED: 'cancelled',
};
