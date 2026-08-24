import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripsService } from './trips.service';
import { GoogleMapsService } from '../maps/google-maps.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    trip: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    tripStop: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    tripWaypoint: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    tripCollaborator: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    stop: { findUnique: vi.fn() },
    $transaction: vi.fn((arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg)
    ),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    ...overrides,
  };
  const service = new TripsService(prisma as never, {} as GoogleMapsService);
  return { service, prisma };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TripsService.maybeRequeueRoute', () => {
  it('queues route computation for an unrouted trip on first read', () => {
    const { service } = makeService();
    const queueSpy = vi.spyOn(service as unknown as { queueRouteComputation: (id: string) => void }, 'queueRouteComputation');

    service['maybeRequeueRoute']('t1');

    expect(queueSpy).toHaveBeenCalledWith('t1');
  });

  it('throttles re-enqueues within the minimum interval', () => {
    const { service } = makeService();
    const queueSpy = vi.spyOn(service as unknown as { queueRouteComputation: (id: string) => void }, 'queueRouteComputation');

    service['maybeRequeueRoute']('t1');
    service['maybeRequeueRoute']('t1');

    expect(queueSpy).toHaveBeenCalledTimes(1);
  });

  it('allows a re-enqueue after the interval elapses', async () => {
    const { service } = makeService();
    const queueSpy = vi.spyOn(service as unknown as { queueRouteComputation: (id: string) => void }, 'queueRouteComputation');

    service['maybeRequeueRoute']('t1');
    service['routeRequeuedAt'].set('t1', Date.now() - 61_000);
    service['maybeRequeueRoute']('t1');

    expect(queueSpy).toHaveBeenCalledTimes(2);
  });
});

describe('TripsService.queueRouteComputation', () => {
  it('skips if a route computation is already in flight', () => {
    const { service } = makeService();
    const computeSpy = vi
      .spyOn(service as unknown as { computeRouteWithRetry: (id: string) => Promise<void> }, 'computeRouteWithRetry')
      .mockResolvedValue();

    service['routeInFlight'].add('t1');
    service['queueRouteComputation']('t1');

    expect(computeSpy).not.toHaveBeenCalled();
  });
});
