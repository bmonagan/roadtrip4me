import { describe, expect, it, vi } from 'vitest';
import { VotesService } from './votes.service';

function makeStop() {
  return {
    id: 's1',
    name: 'Cadillac Ranch',
    description: 'A Texas icon.',
    category: 'attraction',
    imageUrl: null,
    lat: 35.18,
    lng: -101.98,
    street: null,
    city: 'Amarillo',
    state: 'TX',
    country: 'US',
    postalCode: null,
    externalId: null,
    score: 3,
    voteCount: 5,
    submittedByUserId: 'u1',
    createdAt: new Date(),
  };
}

function makeService() {
  const prisma = {
    stop: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    vote: { upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      // array form: elements are already-invoked prisma calls (promises)
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      // callback form: run the callback with the prisma mock as the tx client
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
    $queryRaw: vi.fn(),
  };
  const service = new VotesService(prisma as never);
  return { service, prisma };
}

describe('VotesService.cast', () => {
  it('locks the stop row before upserting so score recalcs serialize', async () => {
    const { service, prisma } = makeService();
    prisma.stop.findUnique.mockResolvedValue({ id: 's1' });
    prisma.vote.upsert.mockResolvedValue({});
    prisma.vote.aggregate.mockResolvedValue({ _sum: { value: 3 }, _count: { value: 5 } });
    prisma.stop.update.mockResolvedValue({});
    prisma.stop.findUniqueOrThrow.mockResolvedValue(makeStop());
    prisma.vote.findUnique.mockResolvedValue({ value: 1 });

    await service.cast('u1', 's1', 1);

    // First call inside the tx is the row lock.
    const calls = prisma.$queryRaw.mock.calls;
    expect(calls.length).toBe(1);
    expect(String(calls[0]![0])).toContain('FOR UPDATE');
    expect(prisma.vote.upsert).toHaveBeenCalled();
  });

  it('locks the stop row on remove when a vote is deleted', async () => {
    const { service, prisma } = makeService();
    prisma.vote.deleteMany.mockResolvedValue({ count: 1 });
    prisma.vote.aggregate.mockResolvedValue({ _sum: { value: 2 }, _count: { value: 4 } });
    prisma.stop.update.mockResolvedValue({});

    await service.remove('u1', 's1');

    const calls = prisma.$queryRaw.mock.calls;
    expect(calls.length).toBe(1);
    expect(String(calls[0]![0])).toContain('FOR UPDATE');
  });

  it('does not lock or recalc when removing a nonexistent vote', async () => {
    const { service, prisma } = makeService();
    prisma.vote.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('u1', 's1')).rejects.toThrow('Vote not found');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.vote.aggregate).not.toHaveBeenCalled();
  });
});
