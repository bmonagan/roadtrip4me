import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminGuard } from './admin.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

function makeContext(user: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: (): AuthenticatedRequest =>
        ({ user, headers: {} }) as AuthenticatedRequest,
    }),
  } as Parameters<AdminGuard['canActivate']>[0];
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows an authenticated admin', () => {
    expect(guard.canActivate(makeContext({ id: 'u1', isAdmin: true }))).toBe(true);
  });

  it('rejects a non-admin authenticated user', () => {
    expect(() => guard.canActivate(makeContext({ id: 'u1', isAdmin: false }))).toThrow(
      ForbiddenException
    );
  });

  it('rejects an unauthenticated request', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
