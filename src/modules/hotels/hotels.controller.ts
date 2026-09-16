import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard, OptionalAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES } from '../../config/configuration';
import type { User } from '../../types/models';
import {
  CreateHotelDto,
  CreateReviewDto,
  HotelDetailQuery,
  HotelListQuery,
  UpdateHotelDto,
} from './dto/hotel.dto';
import { HotelsService } from './hotels.service';

@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  // Declared before `:id` so the literal path wins the route match.
  @Get('facets')
  facets() {
    return this.hotels.facets();
  }

  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@Query() query: HotelListQuery, @CurrentUser() user?: User) {
    return this.hotels.list(query, user);
  }

  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  detail(
    @Param('id') id: string,
    @Query() query: HotelDetailQuery,
    @CurrentUser() user?: User,
  ) {
    return this.hotels.detail(id, query, user);
  }

  @Get(':id/availability')
  availability(@Param('id') id: string, @Query() query: HotelDetailQuery) {
    return this.hotels.availabilityFor(id, query);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  review(@Param('id') id: string, @Body() dto: CreateReviewDto, @CurrentUser() user: User) {
    return this.hotels.addReview(id, dto, user);
  }

  // -------------------------------------------------------------- admin CRUD

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN)
  create(@Body() dto: CreateHotelDto) {
    return this.hotels.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateHotelDto) {
    return this.hotels.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN)
  remove(@Param('id') id: string) {
    return this.hotels.remove(id);
  }
}
