import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES } from '../../config/configuration';
import type { User } from '../../types/models';
import { BookingsService } from './bookings.service';
import {
  BookingListQuery,
  CancelBookingDto,
  CreateBookingDto,
  QuoteQuery,
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  // Public: the checkout page prices a stay before the guest signs in.
  @Get('quote')
  quote(@Query() query: QuoteQuery) {
    return this.bookings.quote(query);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query() query: BookingListQuery, @CurrentUser() user: User) {
    return this.bookings.list(query, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookings.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    return this.bookings.create(dto, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.EMPLOYEE, ROLES.ADMIN)
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.bookings.setStatus(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @CurrentUser() user: User) {
    return this.bookings.cancel(id, dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto, @CurrentUser() user: User) {
    return this.bookings.update(id, dto, user);
  }
}
