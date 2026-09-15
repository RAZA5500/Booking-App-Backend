import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config, ROLES } from '../config.js';
import { db } from '../db/store.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import {
  clearRefreshCookie, publicUser, requireAuth, setRefreshCookie,
  signAccessToken, signRefreshToken, verifyRefreshToken,
} from '../middleware/auth.js';

const router = Router();

// Brute-force protection on the credential endpoints only.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

const nextUserId = () => {
  const max = db.all('users').reduce((acc, u) => Math.max(acc, Number(u.id.split('_')[1]) || 0), 0);
  return `usr_${String(max + 1).padStart(4, '0')}`;
};

const issueSession = (res, user) => {
  db.update('users', user.id, { lastLoginAt: new Date().toISOString() });
  setRefreshCookie(res, signRefreshToken(user));
  return { user: publicUser(db.byId('users', user.id)), accessToken: signAccessToken(user) };
};

router.post(
  '/register',
  authLimiter,
  validate({
    name: 'required|string|min:2|max:80',
    email: 'required|email',
    password: 'required|password',
    phone: 'string|max:32',
  }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    if (db.find('users', (u) => u.email === email)) {
      throw ApiError.conflict('An account with that email already exists.', {
        email: 'That email is already registered.',
      });
    }

    // Self-registration always creates a customer. Staff accounts are created by
    // an admin through /api/users, so the role can never be chosen by the client.
    const user = db.insert('users', {
      id: nextUserId(),
      name: req.body.name.trim(),
      email,
      passwordHash: await bcrypt.hash(req.body.password, config.bcryptRounds),
      role: ROLES.CUSTOMER,
      phone: req.body.phone?.trim() || null,
      hotelId: null,
      avatarSeed: req.body.name.trim().split(' ')[0].toLowerCase(),
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    res.status(201).json(issueSession(res, user));
  })
);

router.post(
  '/login',
  authLimiter,
  validate({ email: 'required|email', password: 'required|string' }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const user = db.find('users', (u) => u.email === email);

    // One message for both branches so the endpoint cannot be used to discover
    // which addresses are registered.
    const ok = user && (await bcrypt.compare(req.body.password, user.passwordHash));
    if (!ok) throw ApiError.unauthorized('That email and password do not match.');
    if (!user.active) throw ApiError.forbidden('This account has been deactivated.');

    res.json(issueSession(res, user));
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[config.refreshCookie];
    if (!token) throw ApiError.unauthorized('No active session.');

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res);
      throw ApiError.unauthorized('Your session expired. Please sign in again.');
    }

    const user = db.byId('users', payload.sub);
    if (!user || !user.active || (user.tokenVersion || 0) !== (payload.tv || 0)) {
      clearRefreshCookie(res);
      throw ApiError.unauthorized('Your session is no longer valid.');
    }

    // Rotate the refresh token on every use.
    setRefreshCookie(res, signRefreshToken(user));
    res.json({ user: publicUser(user), accessToken: signAccessToken(user) });
  })
);

router.post('/logout', (req, res) => {
  clearRefreshCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch(
  '/me',
  requireAuth,
  validate({ name: 'string|min:2|max:80', phone: 'string|max:32' }),
  asyncHandler(async (req, res) => {
    const patch = {};
    if (req.body.name !== undefined) patch.name = req.body.name.trim();
    if (req.body.phone !== undefined) patch.phone = req.body.phone.trim() || null;
    const updated = db.update('users', req.user.id, patch);
    res.json({ user: publicUser(updated) });
  })
);

router.post(
  '/change-password',
  requireAuth,
  validate({ currentPassword: 'required|string', newPassword: 'required|password' }),
  asyncHandler(async (req, res) => {
    const ok = await bcrypt.compare(req.body.currentPassword, req.user.passwordHash);
    if (!ok) {
      throw ApiError.badRequest('That is not your current password.', {
        currentPassword: 'Incorrect password.',
      });
    }

    // Bumping tokenVersion invalidates refresh tokens held anywhere else.
    db.update('users', req.user.id, {
      passwordHash: await bcrypt.hash(req.body.newPassword, config.bcryptRounds),
      tokenVersion: (req.user.tokenVersion || 0) + 1,
    });

    const user = db.byId('users', req.user.id);
    setRefreshCookie(res, signRefreshToken(user));
    res.json({ ok: true, accessToken: signAccessToken(user) });
  })
);

export default router;
