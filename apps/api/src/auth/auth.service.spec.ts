import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { AuthService } from './auth.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
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

  function setAuthEnabled() {
    process.env['AUTH_DISABLED'] = 'false';
    process.env['AUTH0_DOMAIN'] = 'dev-tenant.us.auth0.com';
  }

  it('rejects a missing bearer token', async () => {
    setAuthEnabled();
    const { service } = makeService();
    await expect(service.resolve(undefined, 'u1')).rejects.toThrow(UnauthorizedException);
  });

  it('returns the user when their authId matches', async () => {
    setAuthEnabled();
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', authId: 'auth0|alice' });

    const user = await service['resolveAccount']({
      authId: 'auth0|alice',
      email: 'alice@example.com',
    });
    expect(user.id).toBe('u1');
  });

  it('links an existing user by email and adopts the new authId', async () => {
    setAuthEnabled();
    const { service, prisma } = makeService();
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u_seed', email: 'alice@example.com' });
    prisma.user.update.mockResolvedValue({ id: 'u_seed', authId: 'auth0|new' });

    const user = await service['resolveAccount']({
      authId: 'auth0|new',
      email: 'alice@example.com',
    });
    expect(user.id).toBe('u_seed');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u_seed' },
      data: { authId: 'auth0|new' },
    });
  });

  it('creates a new user when no match exists', async () => {
    setAuthEnabled();
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u_new',
      authId: 'auth0|new',
      email: 'new@example.com',
      displayName: 'New Person',
    });

    const user = await service['resolveAccount']({
      authId: 'auth0|new',
      email: 'new@example.com',
      name: 'New Person',
    });
    expect(user.id).toBe('u_new');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        authId: 'auth0|new',
        email: 'new@example.com',
        displayName: 'New Person',
        avatarUrl: null,
      },
    });
  });

  it('throws when no match exists and there is no email to provision with', async () => {
    setAuthEnabled();
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service['resolveAccount']({ authId: 'auth0|ghost' })
    ).rejects.toThrow(UnauthorizedException);
  });
});
