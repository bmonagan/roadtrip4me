import { describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';

function makeController() {
  const prisma = {
    user: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    $transaction: vi.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
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
    recommendationCount: 0,
    recommendationCountDay: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('UsersController admin endpoints', () => {
  it('lists users as admin views (paginated)', async () => {
    const { controller, prisma } = makeController();
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([makeUser()]);

    const result = await controller.adminList({ page: 1, pageSize: 50 });
    expect(result.data[0]).toEqual({
      id: 'u1',
      email: 'a@example.com',
      displayName: 'A',
      avatarUrl: null,
      isPremium: false,
      isAdmin: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.total).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('updates isPremium for a user', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue(makeUser({ isPremium: true }));

    const actor = makeUser({ id: 'admin1', isAdmin: true });
    const result = await controller.adminUpdate(actor, 'u1', { isPremium: true });
    expect(result.isPremium).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isPremium: true },
    });
  });

  it('promotes a user to admin', async () => {
    const { controller, prisma } = makeController();
    prisma.user.update.mockResolvedValue(makeUser({ isAdmin: true }));

    const actor = makeUser({ id: 'admin1', isAdmin: true });
    const result = await controller.adminUpdate(actor, 'u1', { isAdmin: true });
    expect(result.isAdmin).toBe(true);
  });

  it('blocks an admin from removing their own admin role', async () => {
    const { controller, prisma } = makeController();
    const actor = makeUser({ id: 'admin1', isAdmin: true });

    await expect(controller.adminUpdate(actor, 'admin1', { isAdmin: false })).rejects.toThrow(
      'own admin role'
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('deletes a user', async () => {
    const { controller, prisma } = makeController();
    prisma.user.delete.mockResolvedValue({});

    const actor = makeUser({ id: 'admin1', isAdmin: true });
    const result = await controller.adminDelete(actor, 'u1');
    expect(result).toEqual({ deleted: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('blocks an admin from deleting their own account', async () => {
    const { controller, prisma } = makeController();
    const actor = makeUser({ id: 'admin1', isAdmin: true });

    await expect(controller.adminDelete(actor, 'admin1')).rejects.toThrow('own account');
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
