import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/store.js';
import { ApiError } from './errors.js';

export const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, role: user.role, email: user.email, hotelId: user.hotelId || null },
    config.accessSecret,
    { expiresIn: config.accessTtl }
  );

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user.id, tv: user.tokenVersion || 0 }, config.refreshSecret, {
    expiresIn: config.refreshTtl,
  });

export const verifyRefreshToken = (token) => jwt.verify(token, config.refreshSecret);

export const setRefreshCookie = (res, token) => {
  res.cookie(config.refreshCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.refreshCookieMaxAge,
    path: '/api/auth',
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(config.refreshCookie, { path: '/api/auth' });
};

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  hotelId: user.hotelId,
  avatarSeed: user.avatarSeed,
  active: user.active,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const readBearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Populates req.user when a valid access token is present, otherwise moves on. */
export const optionalAuth = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.accessSecret);
    const user = db.byId('users', payload.sub);
    if (user && user.active) req.user = user;
  } catch {
    // An expired or malformed token is simply treated as "not signed in";
    // the client refreshes and retries.
  }
  return next();
};

export const requireAuth = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = jwt.verify(token, config.accessSecret);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return next(
      new ApiError(401, expired ? 'Your session expired. Please sign in again.' : 'Invalid session.')
    );
  }

  const user = db.byId('users', payload.sub);
  if (!user) return next(ApiError.unauthorized('That account no longer exists.'));
  if (!user.active) return next(ApiError.forbidden('This account has been deactivated.'));

  req.user = user;
  return next();
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This action is limited to: ${roles.join(', ')}.`));
  }
  return next();
};

/**
 * Staff may only touch bookings for the hotel they are assigned to. Admins are
 * unscoped. Returns true when the user may act on the booking.
 */
export const canManageBooking = (user, booking) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'employee') return !user.hotelId || user.hotelId === booking.hotelId;
  return booking.userId === user.id;
};
