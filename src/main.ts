// Must come first: the config module reads process.env the moment it is
// imported, so api/.env has to be on it by then.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { buildValidationPipe } from './common/validation';
import { config } from './config/configuration';
import { SeedService } from './database/seed.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn', 'log'],
  });

  app.useBodyParser('json', { limit: '256kb' });
  app.set('trust proxy', 1);
  app.use(cookieParser());

  app.enableCors({
    origin: config.clientOrigin,
    credentials: true, // the refresh token travels as an httpOnly cookie
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(buildValidationPipe());

  const summary = app.get(SeedService).seedIfEmpty();

  await app.listen(config.port);

  console.log(`\n  Stayscape API  →  http://localhost:${config.port}/api`);
  console.log(`  CORS origin    →  ${config.clientOrigin}`);
  console.log(
    summary.seeded
      ? `  Seeded         →  ${summary.hotels} hotels, ${summary.users} users, ${summary.bookings} bookings`
      : `  Database       →  ${summary.hotels} hotels, ${summary.users} users (existing)`,
  );
  console.log('\n  Demo logins: admin@stayscape.com / Admin@123');
  console.log('               employee@stayscape.com / Employee@123');
  console.log('               customer@stayscape.com / Customer@123\n');
}

void bootstrap();
