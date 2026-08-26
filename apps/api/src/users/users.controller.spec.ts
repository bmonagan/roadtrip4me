import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';

function makeController() {
  const prisma = {
    user: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  };
  const controller = new UsersController(prisma as never);
  return { controller, prisma };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    authId: 'auth0|x',
    email: 'a@example.com',
    displayName: 'A',
    avatarUrl: null,
    isPremium: false,
    isAdmin: false,
    stripeCustomerId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('UsersController admin endpoints', () => {
  it('lists users as admin views', async () => {
    const { controller, prisma } = makeController();
    prisma.user.findMany.mockResolvedValue([makeUser()]);

    const result = await controller.adminList();
    expect(result[0]).toEqual({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      avatarUrl: null,
      isPremium: false,
      isAdmin: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('updates isPremium for a user', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue(makeUser({ isPremium: true }));

    const result = await controller.adminUpdate('u1', { isPremium: true });
    expect(result.isPremium).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isPremium: true },
    });
  });

  it('promotes a user to admin', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue(makeUser({ isAdmin: true }));

    const result = await controller.adminUpdate('u1', { isAdmin: true });
    expect(result.isAdmin).toBe(true);
  });

  it('deletes a user', async () => {
    const { controller, prisma } = makeController();
    prisma.user.delete.mockResolvedValue({});

    const result = await controller.adminDelete('u1');
    expect(result).toEqual({ deleted: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
