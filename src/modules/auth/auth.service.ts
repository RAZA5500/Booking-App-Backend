import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { ApiException } from '../../common/api-exception';
import { publicUser } from '../../common/public-user';
import { ROLES, config } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import type { PublicUser, User } from '../../types/models';
import { ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';

export interface Session {
  user: PublicUser;
  accessToken: string;
}

interface RefreshPayload {
  sub: string;
  tv: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly store: StoreService,
    private readonly jwt: JwtService,
  ) {}

  // ------------------------------------------------------------- tokens

  signAccessToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id, role: user.role, email: user.email, hotelId: user.hotelId || null },
      { secret: config.accessSecret, expiresIn: config.accessTtl },
    );
  }

  signRefreshToken(user: User): string {
    return this.jwt.sign(
      { sub: user.id, tv: user.tokenVersion || 0 },
      { secret: config.refreshSecret, expiresIn: config.refreshTtl },
    );
  }

  setRefreshCookie(res: Response, token: string): void {
    res.cookie(config.refreshCookie, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: config.refreshCookieMaxAge,
      path: '/api/auth',
    });
  }

  clearRefreshCookie(res: Response): void {
    res.clearCookie(config.refreshCookie, { path: '/api/auth' });
  }

  private issueSession(res: Response, user: User): Session {
    this.store.update('users', user.id, { lastLoginAt: new Date().toISOString() });
    this.setRefreshCookie(res, this.signRefreshToken(user));
    return {
      user: publicUser(this.store.byId('users', user.id) as User),
      accessToken: this.signAccessToken(user),
    };
  }

  private nextUserId(): string {
    const max = this.store
      .all('users')
      .reduce((acc, u) => Math.max(acc, Number(u.id.split('_')[1]) || 0), 0);
    return `usr_${String(max + 1).padStart(4, '0')}`;
  }

  // ------------------------------------------------------------ handlers

  async register(dto: RegisterDto, res: Response): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    if (this.store.find('users', (u) => u.email === email)) {
      throw ApiException.conflict('An account with that email already exists.', {
        email: 'That email is already registered.',
      });
    }

    // Self-registration always creates a customer. Staff accounts are created by
    // an admin through /api/users, so the role can never be chosen by the client.
    const user = this.store.insert('users', {
      id: this.nextUserId(),
      name: dto.name.trim(),
      email,
      passwordHash: await bcrypt.hash(dto.password, config.bcryptRounds),
      role: ROLES.CUSTOMER,
      phone: dto.phone?.trim() || null,
      hotelId: null,
      avatarSeed: dto.name.trim().split(' ')[0].toLowerCase(),
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    return this.issueSession(res, user);
  }

  async login(dto: LoginDto, res: Response): Promise<Session> {
    const email = dto.email.trim().toLowerCase();
    const user = this.store.find('users', (u) => u.email === email);

    // One message for both branches so the endpoint cannot be used to discover
    // which addresses are registered.
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!ok || !user) throw ApiException.unauthorized('That email and password do not match.');
    if (!user.active) throw ApiException.forbidden('This account has been deactivated.');

    return this.issueSession(res, user);
  }

  refresh(token: string | undefined, res: Response): Session {
    if (!token) throw ApiException.unauthorized('No active session.');

    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(token, { secret: config.refreshSecret });
    } catch {
      this.clearRefreshCookie(res);
      throw ApiException.unauthorized('Your session expired. Please sign in again.');
    }

    const user = this.store.byId('users', payload.sub);
    if (!user || !user.active || (user.tokenVersion || 0) !== (payload.tv || 0)) {
      this.clearRefreshCookie(res);
      throw ApiException.unauthorized('Your session is no longer valid.');
    }

    // Rotate the refresh token on every use.
    this.setRefreshCookie(res, this.signRefreshToken(user));
    return { user: publicUser(user), accessToken: this.signAccessToken(user) };
  }

  updateProfile(user: User, dto: UpdateProfileDto): PublicUser {
    const patch: Partial<User> = {};
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.phone !== undefined) patch.phone = dto.phone.trim() || null;
    return publicUser(this.store.update('users', user.id, patch) as User);
  }

  async changePassword(
    user: User,
    dto: ChangePasswordDto,
    res: Response,
  ): Promise<{ ok: true; accessToken: string }> {
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw ApiException.badRequest('That is not your current password.', {
        currentPassword: 'Incorrect password.',
      });
    }

    // Bumping tokenVersion invalidates refresh tokens held anywhere else.
    this.store.update('users', user.id, {
      passwordHash: await bcrypt.hash(dto.newPassword, config.bcryptRounds),
      tokenVersion: (user.tokenVersion || 0) + 1,
    });

    const updated = this.store.byId('users', user.id) as User;
    this.setRefreshCookie(res, this.signRefreshToken(updated));
    return { ok: true, accessToken: this.signAccessToken(updated) };
  }
}
