import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
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

describe('TripsService.create (free-tier limit)', () => {
  const dto = {
    title: 'Trip',
    origin: { label: 'A', lat: 1, lng: 1 },
    destination: { label: 'B', lat: 2, lng: 2 },
  };

  it('throws ForbiddenException when a free user is at the trip limit', async () => {
    const { service, prisma } = makeService();
    prisma.trip.count.mockResolvedValue(3); // FREE_TRIP_LIMIT

    await expect(service.create('u1', dto as never, false)).rejects.toThrow(
      ForbiddenException
    );
    expect(prisma.trip.create).not.toHaveBeenCalled();
  });

  it('allows a free user under the limit and queues route computation', async () => {
    const { service, prisma } = makeService();
    prisma.trip.count.mockResolvedValue(2);
    const created = { id: 't_new', title: 'Trip' };
    prisma.trip.create.mockResolvedValue(created);
    // findOne is called after the transaction; mock findAccessibleTrip's query.
    prisma.trip.findFirst.mockResolvedValue({
      id: 't_new',
      title: 'Trip',
      originLabel: 'A',
      originLat: 1,
      originLng: 1,
      destLabel: 'B',
      destLat: 2,
      destLng: 2,
      status: 'draft',
      vibes: [],
      startDate: null,
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      waypoints: [],
      tripStops: [],
      collaborators: [],
      encodedPolyline: null,
      totalDistanceMeters: null,
      totalDurationSeconds: null,
    });
    const queueSpy = vi
      .spyOn(service as unknown as { queueRouteComputation: (id: string) => void }, 'queueRouteComputation')
      .mockImplementation(() => {});

    const trip = await service.create('u1', dto as never, false);
    expect(trip.id).toBe('t_new');
    expect(queueSpy).toHaveBeenCalledWith('t_new');
  });

  it('skips the limit check for premium users', async () => {
    const { service, prisma } = makeService();
    const created = { id: 't_new', title: 'Trip' };
    prisma.trip.create.mockResolvedValue(created);
    prisma.trip.findFirst.mockResolvedValue({
      id: 't_new',
      title: 'Trip',
      originLabel: 'A',
      originLat: 1,
      originLng: 1,
      destLabel: 'B',
      destLat: 2,
      destLng: 2,
      status: 'draft',
      vibes: [],
      startDate: null,
      endDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      waypoints: [],
      tripStops: [],
      collaborators: [],
      encodedPolyline: null,
      totalDistanceMeters: null,
      totalDurationSeconds: null,
    });
    vi.spyOn(service as unknown as { queueRouteComputation: (id: string) => void }, 'queueRouteComputation').mockImplementation(() => {});

    const trip = await service.create('u1', dto as never, true);
    expect(trip.id).toBe('t_new');
    expect(prisma.trip.count).not.toHaveBeenCalled();
  });
});
