import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../types/models';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/** The full user record loaded by the auth guards — never the raw JWT payload. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
