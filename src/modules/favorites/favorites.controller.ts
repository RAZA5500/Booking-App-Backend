import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiException } from '../../common/api-exception';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreService } from '../../database/store.service';
import type { User } from '../../types/models';
import { AddFavoriteDto } from './dto/favorite.dto';

/** Saved hotels. Small enough that the controller talks to the store directly. */
@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly store: StoreService) {}

  @Get()
  list(@CurrentUser() user: User) {
    const rows = this.store.all('favorites', (f) => f.userId === user.id);
    const hotels = rows
      .map((f) => this.store.byId('hotels', f.hotelId))
      .filter((h) => h && h.active);

    return { hotelIds: rows.map((f) => f.hotelId), hotels };
  }

  @Post()
  add(
    @Body() dto: AddFavoriteDto,
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { hotelId } = dto;
    if (!this.store.byId('hotels', hotelId)) {
      throw ApiException.notFound('That hotel does not exist.');
    }

    const existing = this.store.find(
      'favorites',
      (f) => f.userId === user.id && f.hotelId === hotelId,
    );
    // Saving something already saved is a no-op, not an error — the heart
    // button can be clicked twice on two tabs.
    if (existing) {
      res.status(HttpStatus.OK);
      return { saved: true };
    }

    this.store.insert('favorites', {
      id: `fav_${user.id}_${hotelId}`,
      userId: user.id,
      hotelId,
      createdAt: new Date().toISOString(),
    });
    return { saved: true };
  }

  @Delete(':hotelId')
  remove(@Param('hotelId') hotelId: string, @CurrentUser() user: User) {
    const row = this.store.find(
      'favorites',
      (f) => f.userId === user.id && f.hotelId === hotelId,
    );
    if (row) this.store.remove('favorites', row.id);
    return { saved: false };
  }
}
