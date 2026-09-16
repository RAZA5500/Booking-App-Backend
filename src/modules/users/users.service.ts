import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ApiException } from '../../common/api-exception';
import { publicUser } from '../../common/public-user';
import { ROLES, config } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import type { PublicUser, User } from '../../types/models';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserListQuery,
} from './dto/user.dto';

interface UserWithStats extends PublicUser {
  bookingsCount: number;
  lifetimeValue: number;
}

@Injectable()
export class UsersService {
  constructor(private readonly store: StoreService) {}

  private nextUserId(): string {
    const max = this.store
      .all('users')
      .reduce((acc, u) => Math.max(acc, Number(u.id.split('_')[1]) || 0), 0);
    return `usr_${String(max + 1).padStart(4, '0')}`;
  }

  private withStats(user: User): UserWithStats {
    const bookings = this.store.all('bookings', (b) => b.userId === user.id);
    const spend = bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.pricing.total, 0);
    return { ...publicUser(user), bookingsCount: bookings.length, lifetimeValue: spend };
  }

  list(query: UserListQuery) {
    const { role, q = '', active, page = '1', limit = '20' } = query;
    const needle = String(q).trim().toLowerCase();

    let rows = this.store.all('users');
    if (role) rows = rows.filter((u) => u.role === role);
    if (active !== undefined) rows = rows.filter((u) => String(u.active) === String(active));
    if (needle) rows = rows.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle));
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const total = rows.length;
    const perPage = Math.min(Number(limit) || 20, 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const start = (currentPage - 1) * perPage;

    return {
      users: rows.slice(start, start + perPage).map((u) => this.withStats(u)),
      pagination: {
        total,
        page: currentPage,
        limit: perPage,
        pages: Math.max(1, Math.ceil(total / perPage)),
      },
      counts: {
        all: this.store.all('users').length,
        customer: this.store.all('users', (u) => u.role === ROLES.CUSTOMER).length,
        employee: this.store.all('users', (u) => u.role === ROLES.EMPLOYEE).length,
        admin: this.store.all('users', (u) => u.role === ROLES.ADMIN).length,
      },
    };
  }

  findOne(id: string) {
    const user = this.store.byId('users', id);
    if (!user) throw ApiException.notFound('No such user.');
    return {
      user: this.withStats(user),
      bookings: this.store.all('bookings', (b) => b.userId === user.id).slice(0, 20),
    };
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (this.store.find('users', (u) => u.email === email)) {
      throw ApiException.conflict('That email is already registered.', {
        email: 'Already in use.',
      });
    }
    if (dto.hotelId && !this.store.byId('hotels', dto.hotelId)) {
      throw ApiException.badRequest('That hotel does not exist.', { hotelId: 'Unknown hotel.' });
    }

    const user = this.store.insert('users', {
      id: this.nextUserId(),
      name: dto.name.trim(),
      email,
      passwordHash: await bcrypt.hash(dto.password, config.bcryptRounds),
      role: dto.role,
      phone: dto.phone?.trim() || null,
      hotelId: dto.role === ROLES.EMPLOYEE ? dto.hotelId || null : null,
      avatarSeed: dto.name.trim().split(' ')[0].toLowerCase(),
      active: true,
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    });

    return { user: this.withStats(user) };
  }

  update(id: string, dto: UpdateUserDto, actor: User) {
    const user = this.store.byId('users', id);
    if (!user) throw ApiException.notFound('No such user.');

    // Guard rails so an admin cannot lock the platform out of itself.
    const admins = this.store.all('users', (u) => u.role === ROLES.ADMIN && u.active);
    const demoting = Boolean(dto.role) && dto.role !== ROLES.ADMIN && user.role === ROLES.ADMIN;
    const deactivating = dto.active === false && user.role === ROLES.ADMIN;
    if ((demoting || deactivating) && admins.length <= 1) {
      throw ApiException.badRequest('This is the last active admin — promote someone else first.');
    }
    if (user.id === actor.id && (demoting || deactivating)) {
      throw ApiException.badRequest('You cannot change your own role or deactivate yourself.');
    }

    const patch: Partial<User> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.active !== undefined) patch.active = dto.active;

    if (dto.hotelId !== undefined) {
      patch.hotelId = dto.hotelId || null;
      if (patch.hotelId && !this.store.byId('hotels', patch.hotelId)) {
        throw ApiException.badRequest('That hotel does not exist.', { hotelId: 'Unknown hotel.' });
      }
    }
    // A non-employee has no hotel posting.
    if (patch.role && patch.role !== ROLES.EMPLOYEE) patch.hotelId = null;
    // Force re-authentication when access level changes.
    if (patch.role || patch.active === false) patch.tokenVersion = (user.tokenVersion || 0) + 1;

    const updated = this.store.update('users', user.id, patch) as User;
    this.store.insert('audit', {
      id: `aud_${Date.now().toString(36)}`,
      actorId: actor.id,
      actorName: actor.name,
      action: 'user.update',
      target: user.id,
      at: new Date().toISOString(),
    });

    return { user: this.withStats(updated) };
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const user = this.store.byId('users', id);
    if (!user) throw ApiException.notFound('No such user.');

    this.store.update('users', user.id, {
      passwordHash: await bcrypt.hash(dto.password, config.bcryptRounds),
      tokenVersion: (user.tokenVersion || 0) + 1,
    });
    return { ok: true, message: `Password reset for ${user.email}.` };
  }

  remove(id: string, actor: User) {
    const user = this.store.byId('users', id);
    if (!user) throw ApiException.notFound('No such user.');
    if (user.id === actor.id) throw ApiException.badRequest('You cannot delete your own account.');

    // Guests with history are deactivated rather than deleted so bookings keep
    // pointing at a real record.
    const hasBookings = this.store.find('bookings', (b) => b.userId === user.id);
    if (hasBookings) {
      const updated = this.store.update('users', user.id, {
        active: false,
        tokenVersion: (user.tokenVersion || 0) + 1,
      }) as User;
      return {
        user: publicUser(updated),
        message: 'User has bookings — deactivated instead of deleted.',
      };
    }

    this.store.remove('users', user.id);
    return { ok: true, message: 'User deleted.' };
  }
}
