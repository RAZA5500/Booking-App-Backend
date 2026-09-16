import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import { ApiException } from '../api-exception';
import { THROTTLE_MESSAGE_KEY } from '../decorators/throttle-message.decorator';

/**
 * The stock guard answers a 429 with Nest's default body. Routing it through
 * `ApiException` keeps the `{ error: { message } }` envelope, and lets a route
 * that sets its own limit explain itself (see the credential endpoints).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    _detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const message = this.reflector.getAllAndOverride<string | undefined>(THROTTLE_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    throw ApiException.tooManyRequests(message || 'Too many requests. Please slow down.');
  }
}
