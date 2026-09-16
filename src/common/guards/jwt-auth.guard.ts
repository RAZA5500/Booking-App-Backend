import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '../../config/configuration';
import { StoreService } from '../../database/store.service';
import { ApiException } from '../api-exception';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  email: string;
  hotelId: string | null;
}

const readBearer = (req: AuthenticatedRequest): string | null => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

/** Rejects the request unless a valid access token names an active user. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly store: StoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readBearer(req);
    if (!token) throw ApiException.unauthorized();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: config.accessSecret,
      });
    } catch (err) {
      const expired = (err as Error).name === 'TokenExpiredError';
      throw new ApiException(
        401,
        expired ? 'Your session expired. Please sign in again.' : 'Invalid session.',
      );
    }

    const user = this.store.byId('users', payload.sub);
    if (!user) throw ApiException.unauthorized('That account no longer exists.');
    if (!user.active) throw ApiException.forbidden('This account has been deactivated.');

    req.user = user;
    return true;
  }
}

/** Populates `req.user` when a valid access token is present, otherwise moves on. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly store: StoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readBearer(req);
    if (!token) return true;

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: config.accessSecret,
      });
      const user = this.store.byId('users', payload.sub);
      if (user && user.active) req.user = user;
    } catch {
      // An expired or malformed token is simply treated as "not signed in";
      // the client refreshes and retries.
    }

    return true;
  }
}
