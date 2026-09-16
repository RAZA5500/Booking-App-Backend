import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThrottleMessage } from '../../common/decorators/throttle-message.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { publicUser } from '../../common/public-user';
import { config } from '../../config/configuration';
import type { User } from '../../types/models';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';

/**
 * Brute-force protection on the credential endpoints only: 20 attempts per 15
 * minutes, in place of the API-wide 300 per minute.
 */
const CredentialLimit = () =>
  applyDecorators(
    Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } }),
    ThrottleMessage('Too many attempts. Please wait a few minutes and try again.'),
  );

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @CredentialLimit()
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.register(dto, res);
  }

  @Post('login')
  @HttpCode(200)
  @CredentialLimit()
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req.cookies?.[config.refreshCookie], res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.auth.clearRefreshCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return { user: publicUser(user) };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return { user: this.auth.updateProfile(user, dto) };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(user, dto, res);
  }
}
