import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { seedIfEmpty } from './db/seed.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import hotelRoutes from './routes/hotels.routes.js';
import bookingRoutes from './routes/bookings.routes.js';
import userRoutes from './routes/users.routes.js';
import favoriteRoutes from './routes/favorites.routes.js';
import statsRoutes from './routes/stats.routes.js';

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true, // the refresh token travels as an httpOnly cookie
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stayscape-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const summary = seedIfEmpty();
app.listen(config.port, () => {
  console.log(`\n  Stayscape API  →  http://localhost:${config.port}/api`);
  console.log(`  CORS origin    →  ${config.clientOrigin}`);
  console.log(
    summary.seeded
      ? `  Seeded         →  ${summary.hotels} hotels, ${summary.users} users, ${summary.bookings} bookings`
      : `  Database       →  ${summary.hotels} hotels, ${summary.users} users (existing)`
  );
  console.log('\n  Demo logins: admin@stayscape.com / Admin@123');
  console.log('               employee@stayscape.com / Employee@123');
  console.log('               customer@stayscape.com / Customer@123\n');
});
