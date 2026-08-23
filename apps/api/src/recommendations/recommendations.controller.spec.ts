import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

function makeController(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: { update: vi.fn() },
    recommendationRequest: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
    ...overrides,
  };
  const controller = new RecommendationsController(
    prisma as never,
    {} as RecommendationsService
  );
  return { controller, prisma };
}

function makeUser(overrides: Partial<{ count: number; day: Date | null }> = {}) {
  return {
    id: 'u1',
    recommendationCount: overrides.count ?? 0,
    recommendationCountDay: overrides.day ?? null,
  };
}

describe('RecommendationsController.consumeDailyBudget', () => {
  it('increments the counter atomically when the update matches', async () => {
    const { controller, prisma } = makeController();
    prisma.$queryRaw.mockResolvedValue([{ recommendationCount: 1 }]);

    await expect(
      controller['consumeDailyBudget'](makeUser() as never)
    ).resolves.toBeUndefined();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String(prisma.$queryRaw.mock.calls[0]![0])).toContain('UPDATE users');
  });

  it('resolves without throwing when the counter is within the limit', async () => {
    const { controller, prisma } = makeController();
    prisma.$queryRaw.mockResolvedValue([{ recommendationCount: 4 }]);

    await expect(
      controller['consumeDailyBudget'](makeUser({ count: 3 }) as never)
    ).resolves.toBeUndefined();
  });

  it('rejects when the update matches no row (limit reached)', async () => {
    const { controller, prisma } = makeController();
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(
      controller['consumeDailyBudget'](makeUser({ count: 10 }) as never)
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('RecommendationsController.request (stale jobs)', () => {
  function tripOwnedMock() {
    return { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) };
  }

  it('returns the existing job id while a fresh job is processing', async () => {
    const prisma = {
      user: { update: vi.fn() },
      trip: tripOwnedMock(),
      $queryRaw: vi.fn().mockResolvedValue([{ recommendationCount: 1 }]),
      recommendationRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          status: 'processing',
          updatedAt: new Date(),
        }),
      },
    };
    const { controller } = makeController(prisma);
    const result = await controller.request(
      makeUser() as never,
      'u1',
      't1',
      {} as never
    );
    expect(result).toEqual({ requestId: 'r1', status: 'processing' });
  });

  it('restarts an orphaned processing job older than the stale threshold', async () => {
    const prisma = {
      user: { update: vi.fn() },
      trip: tripOwnedMock(),
      $queryRaw: vi.fn().mockResolvedValue([{ recommendationCount: 1 }]),
      recommendationRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r_stale',
          status: 'processing',
          updatedAt: new Date(Date.now() - 11 * 60 * 1000),
        }),
        delete: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({ id: 'r_new' }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const { controller } = makeController(prisma);
    await controller.request(makeUser() as never, 'u1', 't1', {} as never);
    expect(prisma.recommendationRequest.delete).toHaveBeenCalledWith({
      where: { id: 'r_stale' },
    });
    expect(prisma.recommendationRequest.create).toHaveBeenCalled();
  });

  it('reports a stale processing job as failed from the status endpoint', async () => {
    const prisma = {
      trip: tripOwnedMock(),
      recommendationRequest: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'r_stale',
          status: 'processing',
          updatedAt: new Date(Date.now() - 11 * 60 * 1000),
        }),
      },
    };
    const { controller } = makeController(prisma);
    const result = await controller.status('u1', 't1');
    expect(result.status).toBe('failed');
  });
});

