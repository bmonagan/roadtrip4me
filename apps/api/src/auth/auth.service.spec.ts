import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthService } from './auth.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findUnique: vi.fn() },
    ...overrides,
  };
  const service = new AuthService(prisma as never);
  return { service, prisma };
}

describe('AuthService (dev fallback)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a user by id when auth is disabled', async () => {
    process.env['AUTH_DISABLED'] = 'true';
    process.env['AUTH0_DOMAIN'] = '';
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', authId: 'auth0|seed' });

    const user = await service.resolve(undefined, 'u1');
    expect(user.id).toBe('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('throws when auth is disabled and no user id is provided', async () => {
    process.env['AUTH_DISABLED'] = 'true';
    const { service } = makeService();
    await expect(service.resolve(undefined, undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('throws for an unknown dev user', async () => {
    process.env['AUTH_DISABLED'] = 'true';
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.resolve(undefined, 'nobody')).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService (auth enabled)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a missing bearer token', async () => {
    process.env['AUTH_DISABLED'] = 'false';
    process.env['AUTH0_DOMAIN'] = 'dev-tenant.us.auth0.com';
    const { service } = makeService();
    await expect(service.resolve(undefined, 'u1')).rejects.toThrow(UnauthorizedException);
  });
});
