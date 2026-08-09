import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User as UserModel } from '../generated/prisma/client';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/** Resolved user for the current request (requires the global guard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserModel => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user!;
  },
);

/** The current user's database id. */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user!.id;
  },
);

/** The current user's id when authenticated, otherwise undefined (public routes). */
export const OptionalUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user?.id;
  },
);
