import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { StatsModule } from './modules/stats/stats.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // A broad ceiling for ordinary browsing; the credential endpoints tighten
    // this with their own @Throttle().
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    CoreModule,
    AuthModule,
    HotelsModule,
    BookingsModule,
    UsersModule,
    FavoritesModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
