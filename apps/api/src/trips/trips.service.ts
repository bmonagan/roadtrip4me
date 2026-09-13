import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  PaginatedResponse,
  Trip,
  TripCollaborator,
  TripSummary,
} from '../types';
import type {
  Stop as StopModel,
  Trip as TripModel,
  TripStop as TripStopModel,
  TripVibe,
  TripWaypoint as TripWaypointModel,
} from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { mapStop } from '../common/mappers/stop.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService } from '../maps/google-maps.service';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { ListTripsQueryDto } from './dto/list-trips-query.dto';
import type { PlaceDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';
import type { AddWaypointDto } from './dto/add-waypoint.dto';
import type { AddCollaboratorDto } from './dto/add-collaborator.dto';

type CollaboratorWithUser = {
  addedAt: Date;
  user: { id: string; email: string; displayName: string };
};

type TripWithRelations = TripModel & {
  waypoints: TripWaypointModel[];
  tripStops: (TripStopModel & { stop: StopModel })[];
  collaborators: CollaboratorWithUser[];
};

const FREE_TRIP_LIMIT = 3;
const FREE_STOP_LIMIT = 5;
// Minimum interval between re-enqueuing route computation for an unrouted trip
// when it's read (polling clients otherwise trigger constant paid calls).
const ROUTE_REQUEUE_MIN_MS = 60_000;

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);
  // Trip ids with a route computation currently queued/running, to dedupe
  // concurrent background jobs (single-process in-flight guard).
  private readonly routeInFlight = new Set<string>();
  // Last time a route recompute was re-enqueued for an unrouted trip on read.
  private readonly routeRequeuedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly maps: GoogleMapsService,
  ) {}

  async create(userId: string, dto: CreateTripDto, isPremium: boolean): Promise<Trip> {
    // Enforce the free-tier trip limit atomically: lock the user row so two
    // concurrent creates can't both pass the count check.
    const trip = await this.prisma.$transaction(async (tx) => {
      if (!isPremium) {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const count = await tx.trip.count({ where: { userId } });
        if (count >= FREE_TRIP_LIMIT) {
          throw new ForbiddenException(`Free accounts are limited to ${FREE_TRIP_LIMIT} trips. Upgrade to Premium for unlimited trips.`);
        }
      }
      const created = await tx.trip.create({
        data: {
          userId,
          title: dto.title,
          originLabel: dto.origin.label,
          originLat: dto.origin.lat,
          originLng: dto.origin.lng,
          destLabel: dto.destination.label,
          destLat: dto.destination.lat,
          destLng: dto.destination.lng,
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.vibes !== undefined && { vibes: dto.vibes }),
          ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
          ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        },
      });
      await this.setGeographyPoints(tx, created.id, dto.origin, dto.destination);
      return created;
    });

    this.queueRouteComputation(trip.id);

    return this.findOne(userId, trip.id);
  }

  async findAll(userId: string, query: ListTripsQueryDto): Promise<PaginatedResponse<TripSummary>> {
    const where = {
      OR: [{ userId }, { collaborators: { some: { userId } } }],
    };
    const [total, trips] = await this.prisma.$transaction([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { tripStops: true } } },
    }),
  ]);

    return {
      data: trips.map(toTripSummary),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: query.page * query.pageSize < total,
    };
  }

  async findOne(userId: string, id: string): Promise<Trip> {
    const trip = await this.findAccessibleTrip(userId, id);

    // Recover trips that lost their background route computation (e.g. the
    // process restarted mid-job): queue a fresh computation without blocking
    // the read. The in-flight guard prevents duplicate paid Google calls, and
    // the last-attempt stamp avoids hammering Google on every poll.
    if (!trip.encodedPolyline) {
      this.maybeRequeueRoute(trip.id);
    }

    return toTrip(trip);
  }

  // Re-queues route computation for an unrouted trip, throttled to once per
  // trip per interval so polling clients don't trigger constant paid calls.
  private maybeRequeueRoute(tripId: string): void {
    const now = Date.now();
    const last = this.routeRequeuedAt.get(tripId) ?? 0;
    if (now - last < ROUTE_REQUEUE_MIN_MS) return;
    this.routeRequeuedAt.set(tripId, now);
    this.queueRouteComputation(tripId);
  }

  async update(userId: string, id: string, dto: UpdateTripDto, _isPremium: boolean): Promise<Trip> {
    await this.ensureTripAccess(userId, id);

    const originChanged = dto.origin !== undefined || dto.destination !== undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.vibes !== undefined && { vibes: dto.vibes as TripVibe[] }),
          ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
          ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
          ...(dto.origin !== undefined && {
            originLabel: dto.origin.label,
            originLat: dto.origin.lat,
            originLng: dto.origin.lng,
          }),
          ...(dto.destination !== undefined && {
            destLabel: dto.destination.label,
            destLat: dto.destination.lat,
            destLng: dto.destination.lng,
          }),
        },
      });

      if (originChanged) {
        const tripRow = await tx.trip.findUniqueOrThrow({
          where: { id },
          select: {
            originLabel: true,
            originLat: true,
            originLng: true,
            destLabel: true,
            destLat: true,
            destLng: true,
          },
        });
        const origin: PlaceDto = dto.origin ?? {
          label: tripRow.originLabel,
          lat: tripRow.originLat,
          lng: tripRow.originLng,
        };
        const destination: PlaceDto = dto.destination ?? {
          label: tripRow.destLabel,
          lat: tripRow.destLat,
          lng: tripRow.destLng,
        };
        await this.setGeographyPoints(tx, id, origin, destination);
      }
    });

    if (originChanged) {
      this.queueRouteComputation(id);
    }

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    await this.ensureTripOwned(userId, id);
    await this.prisma.trip.delete({ where: { id } });
    return { deleted: true };
  }

  async addStop(userId: string, tripId: string, stopId: string, isPremium: boolean): Promise<Trip> {
    await this.ensureTripAccess(userId, tripId);

    const stop = await this.prisma.stop.findUnique({ where: { id: stopId }, select: { id: true } });
    if (!stop) {
      throw new NotFoundException(`Stop ${stopId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Serialize stop mutations per trip so the order computation and the
      // free-tier stop limit can't race with a concurrent request.
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;

      const existing = await tx.tripStop.findUnique({
        where: { tripId_stopId: { tripId, stopId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Stop already on this trip');
      }

      if (!isPremium) {
        const stopCount = await tx.tripStop.count({ where: { tripId } });
        if (stopCount >= FREE_STOP_LIMIT) {
          throw new ForbiddenException(`Free accounts are limited to ${FREE_STOP_LIMIT} stops per trip. Upgrade to Premium for unlimited stops.`);
        }
      }

      // order is unique per trip — append at the end.
      const last = await tx.tripStop.findFirst({
        where: { tripId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      await tx.tripStop.create({ data: { tripId, stopId, order: (last?.order ?? 0) + 1 } });
    });

    this.queueRouteComputation(tripId);
    return this.findOne(userId, tripId);
  }

  async removeStop(userId: string, tripId: string, stopId: string): Promise<Trip> {
    await this.ensureTripAccess(userId, tripId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      // Serialize stop mutations per trip (mirrors addStop) so concurrent
      // removes can't race on the order renumbering below and violate the
      // unique (tripId, order) constraint.
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const result = await tx.tripStop.deleteMany({ where: { tripId, stopId } });
      if (result.count > 0) {
        // Re-number remaining stops so order stays contiguous (no gaps).
        const remaining = await tx.tripStop.findMany({
          where: { tripId },
          orderBy: { order: 'asc' },
          select: { id: true },
        });
        for (const [index, ts] of remaining.entries()) {
          await tx.tripStop.update({ where: { id: ts.id }, data: { order: index + 1 } });
        }
      }
      return result;
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Stop not on this trip');
    }

    this.queueRouteComputation(tripId);
    return this.findOne(userId, tripId);
  }

  async addWaypoint(userId: string, tripId: string, dto: AddWaypointDto): Promise<Trip> {
    await this.ensureTripAccess(userId, tripId);

    await this.prisma.$transaction(async (tx) => {
      // Serialize waypoint inserts per trip so the unique (tripId, order)
      // constraint can't be violated by concurrent requests.
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const last = await tx.tripWaypoint.findFirst({
        where: { tripId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      await tx.tripWaypoint.create({
        data: {
          tripId,
          label: dto.label,
          lat: dto.lat,
          lng: dto.lng,
          order: (last?.order ?? 0) + 1,
        },
      });
    });

    this.queueRouteComputation(tripId);
    return this.findOne(userId, tripId);
  }

  async removeWaypoint(userId: string, tripId: string, waypointId: string): Promise<Trip> {
    await this.ensureTripAccess(userId, tripId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      // Serialize waypoint mutations per trip (mirrors addWaypoint) so
      // concurrent removes can't race on the order renumbering below.
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const result = await tx.tripWaypoint.deleteMany({ where: { id: waypointId, tripId } });
      if (result.count > 0) {
        const remaining = await tx.tripWaypoint.findMany({
          where: { tripId },
          orderBy: { order: 'asc' },
          select: { id: true },
        });
        for (const [index, wp] of remaining.entries()) {
          await tx.tripWaypoint.update({ where: { id: wp.id }, data: { order: index + 1 } });
        }
      }
      return result;
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Waypoint not found');
    }

    this.queueRouteComputation(tripId);
    return this.findOne(userId, tripId);
  }

  async addCollaborator(userId: string, tripId: string, dto: AddCollaboratorDto): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`No account with email ${dto.email}`);
    }
    if (user.id === userId) {
      throw new ConflictException('The trip owner is already a participant');
    }

    await this.prisma.tripCollaborator.upsert({
      where: { tripId_userId: { tripId, userId: user.id } },
      update: {},
      create: { tripId, userId: user.id },
    });

    return this.findOne(userId, tripId);
  }

  async removeCollaborator(userId: string, tripId: string, collaboratorUserId: string): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    await this.prisma.tripCollaborator.deleteMany({
      where: { tripId, userId: collaboratorUserId },
    });

    return this.findOne(userId, tripId);
  }

  // Queues route computation off the request path. Write mutations return
  // immediately; the driving route (a paid Google Routes call) is computed in
  // the background and the web polls until the polyline appears. Transient
  // Google/network failures are retried with backoff.
  private queueRouteComputation(tripId: string): void {
    // In-flight guard: a concurrent job (e.g. from a re-enqueue on read) is
    // already computing this trip's route; skip to avoid duplicate paid calls.
    if (this.routeInFlight.has(tripId)) return;
    this.routeInFlight.add(tripId);

    setImmediate(async () => {
      try {
        await this.computeRouteWithRetry(tripId);
      } catch (error) {
        this.logger.error(
          `Route computation failed for trip ${tripId}: ${(error as Error).message}`
        );
      } finally {
        this.routeInFlight.delete(tripId);
      }
    });
  }

  // Runs computeRoute with a few retries and exponential backoff so transient
  // failures don't leave a trip permanently without a polyline.
  private async computeRouteWithRetry(tripId: string): Promise<void> {
    const MAX_ATTEMPTS = 3;
    let attempt = 0;
    // Wait a beat before retrying so a burst of mutations coalesces into one
    // final computation of the latest state.
    const BASE_DELAY_MS = 1_000;
    while (attempt < MAX_ATTEMPTS) {
      try {
        await this.computeRoute(tripId);
        return;
      } catch (error) {
        attempt += 1;
        if (attempt >= MAX_ATTEMPTS) throw error;
        this.logger.warn(
          `Route computation attempt ${attempt}/${MAX_ATTEMPTS} failed for trip ${tripId}: ${(error as Error).message}`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1))
        );
      }
    }
  }

  // Computes the route and persists distance, duration, and polyline.
  private async computeRoute(tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { originLat: true, originLng: true, destLat: true, destLng: true },
    });
    if (!trip) return;

    const waypoints = await this.prisma.tripWaypoint.findMany({
      where: { tripId },
      orderBy: { order: 'asc' },
      select: { lat: true, lng: true },
    });

    const stops = await this.prisma.tripStop.findMany({
      where: { tripId },
      orderBy: { order: 'asc' },
      include: { stop: { select: { lat: true, lng: true } } },
    });

    const intermediates = [
      ...waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      ...stops.map((s) => ({ lat: s.stop.lat, lng: s.stop.lng })),
    ];
    const route = await this.maps.getRoute(
      { lat: trip.originLat, lng: trip.originLng },
      { lat: trip.destLat, lng: trip.destLng },
      intermediates,
    );
    if (!route) return;

    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        totalDistanceMeters: route.distanceMeters,
        totalDurationSeconds: route.durationSeconds,
        encodedPolyline: route.encodedPolyline,
      },
    });
  }

  // The geography columns are PostGIS-only and unsupported by Prisma, so they
  // are written with raw SQL. Pass a transaction client so the point write is
  // atomic with the row insert/update.
  private setGeographyPoints(
    client: Prisma.TransactionClient,
    tripId: string,
    origin: PlaceDto,
    destination: PlaceDto
  ) {
    return client.$executeRaw`
      UPDATE trips SET
        "originPoint" = ST_SetSRID(ST_Point(${origin.lng}, ${origin.lat}), 4326)::geography,
        "destPoint"   = ST_SetSRID(ST_Point(${destination.lng}, ${destination.lat}), 4326)::geography
      WHERE id = ${tripId}
    `;
  }

  private async ensureTripOwned(userId: string, tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
  }

  private async ensureTripAccess(userId: string, tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
      select: { id: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
  }

  private async findAccessibleTrip(userId: string, id: string): Promise<TripWithRelations> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
      include: {
        waypoints: { orderBy: { order: 'asc' } },
        tripStops: {
          orderBy: { order: 'asc' },
          include: { stop: true },
        },
        collaborators: {
          include: {
            user: { select: { id: true, email: true, displayName: true } },
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    return trip as TripWithRelations;
  }
}

function toTripSummary(trip: {
  id: string;
  title: string;
  status: Trip['status'];
  originLabel: string;
  destLabel: string;
  startDate: Date | null;
  createdAt: Date;
  _count: { tripStops: number };
}): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    status: trip.status,
    origin: trip.originLabel,
    destination: trip.destLabel,
    stopCount: trip._count.tripStops,
    startDate: trip.startDate?.toISOString() ?? null,
    createdAt: trip.createdAt.toISOString(),
  };
}

function toTrip(trip: TripWithRelations): Trip {
  return {
    id: trip.id,
    userId: trip.userId,
    title: trip.title,
    status: trip.status,
    vibes: trip.vibes,
    origin: { label: trip.originLabel, lat: trip.originLat, lng: trip.originLng },
    destination: { label: trip.destLabel, lat: trip.destLat, lng: trip.destLng },
    waypoints: trip.waypoints.map((w) => ({
      id: w.id,
      order: w.order,
      coordinates: { lat: w.lat, lng: w.lng },
      label: w.label,
      stopId: w.stopId,
    })),
    stops: trip.tripStops.map((ts) => mapStop(ts.stop)),
    collaborators: trip.collaborators.map((c): TripCollaborator => ({
      userId: c.user.id,
      email: c.user.email,
      displayName: c.user.displayName,
      addedAt: c.addedAt.toISOString(),
    })),
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    totalDistanceMeters: trip.totalDistanceMeters,
    totalDurationSeconds: trip.totalDurationSeconds,
    encodedPolyline: trip.encodedPolyline,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}
