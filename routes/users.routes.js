import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config, ROLES } from '../config.js';
import { db } from '../db/store.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { validate } from '../middleware/validate.js';
import { publicUser, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

const nextUserId = () => {
  const max = db.all('users').reduce((acc, u) => Math.max(acc, Number(u.id.split('_')[1]) || 0), 0);
  return `usr_${String(max + 1).padStart(4, '0')}`;
};

const withStats = (user) => {
  const bookings = db.all('bookings', (b) => b.userId === user.id);
  const spend = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.pricing.total, 0);
  return { ...publicUser(user), bookingsCount: bookings.length, lifetimeValue: spend };
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, q = '', active, page = 1, limit = 20 } = req.query;
    const needle = String(q).trim().toLowerCase();

    let rows = db.all('users');
    if (role) rows = rows.filter((u) => u.role === role);
    if (active !== undefined) rows = rows.filter((u) => String(u.active) === String(active));
    if (needle) {
      rows = rows.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const total = rows.length;
    const perPage = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    res.json({
      users: rows.slice(start, start + perPage).map(withStats),
      pagination: { total, page: currentPage, limit: perPage, pages: Math.max(1, Math.ceil(total / perPage)) },
      counts: {
        all: db.all('users').length,
        customer: db.all('users', (u) => u.role === ROLES.CUSTOMER).length,
        employee: db.all('users', (u) => u.role === ROLES.EMPLOYEE).length,
        admin: db.all('users', (u) => u.role === ROLES.ADMIN).length,
      },
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = db.byId('users', req.params.id);
    if (!user) throw ApiError.notFound('No such user.');
    res.json({
      user: withStats(user),
      bookings: db.all('bookings', (b) => b.userId === user.id).slice(0, 20),
    });
  })
);

router.post(
  '/',
  validate({
    name: 'required|string|min:2|max:80',
    email: 'required|email',
    password: 'required|password',
    role: 'required|in:customer,employee,admin',
    hotelId: 'string',
    phone: 'string|max:32',
  }),
  asyncHandler(async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    if (db.find('users', (u) => u.email === email)) {
      throw ApiError.conflict('That email is already registered.', { email: 'Already in use.' });
    }
    if (req.body.hotelId && !db.byId('hotels', req.body.hotelId)) {
      throw ApiError.badRequest('That hotel does not exist.', { hotelId: 'Unknown hotel.' });
    }

    const user = db.insert('users', {
      id: nextUserId(),
      name: req.body.name.trim(),
      email,
      passwordHash: await bcrypt.hash(req.body.password, config.bcryptRounds),
      role: req.body.role,
      phone: req.body.phone?.trim() || null,
      hotelId: req.body.role === ROLES.EMPLOYEE ? req.body.hotelId || null : null,
      avatarSeed: req.body.name.trim().split(' ')[0].toLowerCase(),
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    res.status(201).json({ user: withStats(user) });
  })
);

router.patch(
  '/:id',
  validate({
    name: 'string|min:2|max:80',
    role: 'in:customer,employee,admin',
    phone: 'string|max:32',
    active: 'boolean',
    hotelId: 'string',
  }),
  asyncHandler(async (req, res) => {
    const user = db.byId('users', req.params.id);
    if (!user) throw ApiError.notFound('No such user.');

    // Guard rails so an admin cannot lock the platform out of itself.
    const admins = db.all('users', (u) => u.role === ROLES.ADMIN && u.active);
    const demoting = req.body.role && req.body.role !== ROLES.ADMIN && user.role === ROLES.ADMIN;
    const deactivating = req.body.active === false && user.role === ROLES.ADMIN;
    if ((demoting || deactivating) && admins.length <= 1) {
      throw ApiError.badRequest('This is the last active admin — promote someone else first.');
    }
    if (user.id === req.user.id && (demoting || deactivating)) {
      throw ApiError.badRequest('You cannot change your own role or deactivate yourself.');
    }

    const patch = {};
    for (const key of ['name', 'phone', 'role', 'active']) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (req.body.hotelId !== undefined) {
      patch.hotelId = req.body.hotelId || null;
      if (patch.hotelId && !db.byId('hotels', patch.hotelId)) {
        throw ApiError.badRequest('That hotel does not exist.', { hotelId: 'Unknown hotel.' });
      }
    }
    // A non-employee has no hotel posting.
    if (patch.role && patch.role !== ROLES.EMPLOYEE) patch.hotelId = null;
    // Force re-authentication when access level changes.
    if (patch.role || patch.active === false) patch.tokenVersion = (user.tokenVersion || 0) + 1;

    const updated = db.update('users', user.id, patch);
    db.insert('audit', {
      id: `aud_${Date.now().toString(36)}`,
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'user.update',
      target: user.id,
      at: new Date().toISOString(),
    });

    res.json({ user: withStats(updated) });
  })
);

router.post(
  '/:id/reset-password',
  validate({ password: 'required|password' }),
  asyncHandler(async (req, res) => {
    const user = db.byId('users', req.params.id);
    if (!user) throw ApiError.notFound('No such user.');

    db.update('users', user.id, {
      passwordHash: await bcrypt.hash(req.body.password, config.bcryptRounds),
      tokenVersion: (user.tokenVersion || 0) + 1,
    });
    res.json({ ok: true, message: `Password reset for ${user.email}.` });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = db.byId('users', req.params.id);
    if (!user) throw ApiError.notFound('No such user.');
    if (user.id === req.user.id) throw ApiError.badRequest('You cannot delete your own account.');

    // Guests with history are deactivated rather than deleted so bookings keep
    // pointing at a real record.
    const hasBookings = db.find('bookings', (b) => b.userId === user.id);
    if (hasBookings) {
      const updated = db.update('users', user.id, {
        active: false,
        tokenVersion: (user.tokenVersion || 0) + 1,
      });
      return res.json({ user: publicUser(updated), message: 'User has bookings — deactivated instead of deleted.' });
    }

    db.remove('users', user.id);
    return res.json({ ok: true, message: 'User deleted.' });
  })
);

export default router;
