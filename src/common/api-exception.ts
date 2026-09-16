import { HttpException } from '@nestjs/common';

export interface ApiErrorBody {
  message: string;
  details?: Record<string, string>;
}

/**
 * The single error type the application throws. Carrying the message and the
 * optional per-field details through `HttpException` keeps Nest's own
 * exceptions and ours flowing into the same filter, which renders both as
 * `{ error: { message, details? } }` — the shape the React client parses.
 */
export class ApiException extends HttpException {
  readonly details?: Record<string, string>;

  constructor(status: number, message: string, details?: Record<string, string>) {
    super({ message, ...(details ? { details } : {}) } satisfies ApiErrorBody, status);
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, string>) {
    return new ApiException(400, message, details);
  }

  static unauthorized(message = 'You need to sign in to do that.') {
    return new ApiException(401, message);
  }

  static forbidden(message = 'Your account does not have access to that.') {
    return new ApiException(403, message);
  }

  static notFound(message = 'Not found.') {
    return new ApiException(404, message);
  }

  static conflict(message: string, details?: Record<string, string>) {
    return new ApiException(409, message, details);
  }

  static tooManyRequests(message: string) {
    return new ApiException(429, message);
  }
}
