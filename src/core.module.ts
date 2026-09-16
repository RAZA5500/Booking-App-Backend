import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StoreService } from './database/store.service';
import { SeedService } from './database/seed.service';
import { PricingService } from './domain/pricing.service';
import { AvailabilityService } from './domain/availability.service';
import { JwtAuthGuard, OptionalAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

/**
 * Persistence, pricing, availability and the auth guards are needed by nearly
 * every feature module, so they are registered once here as a global module
 * rather than re-imported six times.
 *
 * `JwtModule` is registered without a secret on purpose: access and refresh
 * tokens are signed with different keys, so each call passes its own.
 */
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    StoreService,
    SeedService,
    PricingService,
    AvailabilityService,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [
    JwtModule,
    StoreService,
    SeedService,
    PricingService,
    AvailabilityService,
    JwtAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
})
export class CoreModule {}
