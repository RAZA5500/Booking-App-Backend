import { Router } from 'express';
import { db } from '../db/store.js';
import { ApiError, asyncHandler } from '../middleware/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = db.all('favorites', (f) => f.userId === req.user.id);
    const hotels = rows
      .map((f) => db.byId('hotels', f.hotelId))
      .filter((h) => h && h.active);

    res.json({ hotelIds: rows.map((f) => f.hotelId), hotels });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { hotelId } = req.body;
    if (!db.byId('hotels', hotelId)) throw ApiError.notFound('That hotel does not exist.');

    const existing = db.find('favorites', (f) => f.userId === req.user.id && f.hotelId === hotelId);
    if (existing) return res.json({ saved: true });

    db.insert('favorites', {
      id: `fav_${req.user.id}_${hotelId}`,
      userId: req.user.id,
      hotelId,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ saved: true });
  })
);

router.delete(
  '/:hotelId',
  asyncHandler(async (req, res) => {
    const row = db.find(
      'favorites',
      (f) => f.userId === req.user.id && f.hotelId === req.params.hotelId
    );
    if (row) db.remove('favorites', row.id);
    res.json({ saved: false });
  })
);

export default router;
