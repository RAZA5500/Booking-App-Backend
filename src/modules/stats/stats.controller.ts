import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES } from '../../config/configuration';
import type { User } from '../../types/models';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('admin')
  @Roles(ROLES.ADMIN)
  admin() {
    return this.stats.admin();
  }

  @Get('employee')
  @Roles(ROLES.EMPLOYEE, ROLES.ADMIN)
  employee(@CurrentUser() user: User, @Query('hotelId') hotelId?: string) {
    return this.stats.employee(user, hotelId);
  }

  /** Any signed-in guest's own travel summary. */
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.stats.forUser(user);
  }
}
