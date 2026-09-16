import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from '../database/seed.service';
import { StoreService } from '../database/store.service';

/**
 * Rebuilds the demo dataset from scratch. Uses a standalone application context
 * so nothing binds a port, and waits on the store's write queue before exiting.
 */
async function reseed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const summary = app.get(SeedService).seedIfEmpty({ force: true });
  await app.get(StoreService).flush();
  await app.close();

  console.log(
    `Reseeded: ${summary.hotels} hotels, ${summary.users} users, ${summary.bookings} bookings.`,
  );
}

void reseed();
