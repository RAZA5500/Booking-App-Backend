import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorBody, ApiException } from '../api-exception';

/**
 * Renders every failure as `{ error: { message, details? } }`. Anything that is
 * not an `HttpException` is a bug, so it is logged in full and reported to the
 * client as a generic 500 — internals never leak out of here.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('api');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      res.status(status).json({ error: { message: 'Something went wrong on our side.' } });
      return;
    }

    res.status(status).json({ error: this.body(exception, status, req) });
  }

  private body(exception: unknown, status: number, req: Request): ApiErrorBody {
    if (exception instanceof ApiException) {
      return {
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }

    // A 404 that no controller raised means the router found no route at all.
    if (status === HttpStatus.NOT_FOUND) {
      return { message: `No route for ${req.method} ${req.originalUrl}` };
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') return { message: payload };
      const record = payload as { message?: string | string[]; details?: Record<string, string> };
      const message = Array.isArray(record.message) ? record.message[0] : record.message;
      return {
        message: message || exception.message,
        ...(record.details ? { details: record.details } : {}),
      };
    }

    return { message: 'Something went wrong on our side.' };
  }
}
