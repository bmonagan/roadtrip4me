import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

function makeController() {
  const prisma = { user: { update: vi.fn() } };
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
  it('increments the counter on the first run of a day', async () => {
    const { controller, prisma } = makeController();
    await controller['consumeDailyBudget'](makeUser() as never);

    const [arg] = prisma.user.update.mock.calls[0] as unknown[];
    const data = (arg as { data: { recommendationCount: number; recommendationCountDay: Date } }).data;
    expect(data.recommendationCount).toBe(1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(new Date(data.recommendationCountDay).getTime()).toBe(today.getTime());
  });

  it('increments within the same day', async () => {
    const { controller, prisma } = makeController();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await controller['consumeDailyBudget'](makeUser({ count: 3, day: today }) as never);

    const [arg] = prisma.user.update.mock.calls[0] as unknown[];
    const data = (arg as { data: { recommendationCount: number } }).data;
    expect(data.recommendationCount).toBe(4);
  });

  it('resets the counter when the day changes', async () => {
    const { controller, prisma } = makeController();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await controller['consumeDailyBudget'](makeUser({ count: 9, day: yesterday }) as never);

    const [arg] = prisma.user.update.mock.calls[0] as unknown[];
    const data = (arg as { data: { recommendationCount: number } }).data;
    expect(data.recommendationCount).toBe(1);
  });

  it('rejects when the daily limit is reached', async () => {
    const { controller } = makeController();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await expect(
      controller['consumeDailyBudget'](makeUser({ count: 10, day: today }) as never)
    ).rejects.toThrow(ForbiddenException);
  });
});
