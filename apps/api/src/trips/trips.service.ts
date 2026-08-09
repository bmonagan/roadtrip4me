import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { PaginatedResponse, Trip, TripSummary } from '@roadtrip4me/types';
import type {
  Stop as StopModel,
  Trip as TripModel,
  TripStop as TripStopModel,
  TripVibe,
  TripWaypoint as TripWaypointModel,
} from '../generated/prisma/client';
import { mapStop } from '../common/mappers/stop.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { ComputeRouteJobData } from '../jobs/route.processor';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { ListTripsQueryDto } from './dto/list-trips-query.dto';
import type { PlaceDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';
import type { AddWaypointDto } from './dto/add-waypoint.dto';

type TripWithRelations = TripModel & {
  waypoints: TripWaypointModel[];
  tripStops: (TripStopModel & { stop: StopModel })[];
};

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('route') private readonly routeQueue: Queue
  ) {}

  async create(userId: string, dto: CreateTripDto): Promise<Trip> {
    const trip = await this.prisma.trip.create({
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

    await this.setGeographyPoints(trip.id, dto.origin, dto.destination);
    await this.enqueueRoute(trip.id);

    return this.findOne(userId, trip.id);
  }

  async findAll(userId: string, query: ListTripsQueryDto): Promise<PaginatedResponse<TripSummary>> {
    const where = { userId };
    const [total, trips] = await this.prisma.$transaction([
      this.prisma.trip.count({ where }),
      this.prisma.trip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { tripStops: { select: { order: true } } },
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
    const trip = await this.findOwnedTrip(userId, id);

    // Lazy-fill the route for trips created before routing existed (e.g. seed).
    // Route computation is async now — enqueue it (deduped by jobId) and let
    // the frontend refetch once the worker persists the result.
    if (!trip.encodedPolyline) {
      await this.enqueueRoute(id);
    }

    return toTrip(trip);
  }

  async update(userId: string, id: string, dto: UpdateTripDto): Promise<Trip> {
    await this.ensureTripOwned(userId, id);

    const updated = await this.prisma.trip.update({
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

    if (dto.origin !== undefined || dto.destination !== undefined) {
      const origin: PlaceDto =
        dto.origin ??
        ({
          label: updated.originLabel,
          lat: updated.originLat,
          lng: updated.originLng,
        } as PlaceDto);
      const destination: PlaceDto =
        dto.destination ??
        ({ label: updated.destLabel, lat: updated.destLat, lng: updated.destLng } as PlaceDto);
      await this.setGeographyPoints(updated.id, origin, destination);
      await this.enqueueRoute(id);
    }

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const trip = await this.findOwnedTrip(userId, id);
    await this.prisma.trip.delete({ where: { id: trip.id } });
    return { deleted: true };
  }

  async addStop(userId: string, tripId: string, stopId: string): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    const stop = await this.prisma.stop.findUnique({ where: { id: stopId }, select: { id: true } });
    if (!stop) {
      throw new NotFoundException(`Stop ${stopId} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tripStop.findUnique({
        where: { tripId_stopId: { tripId, stopId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Stop already on this trip');
      }

      // order is unique per trip — append at the end.
      const last = await tx.tripStop.findFirst({
        where: { tripId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      await tx.tripStop.create({ data: { tripId, stopId, order: (last?.order ?? 0) + 1 } });
    });

    await this.enqueueRoute(tripId);
    return this.findOne(userId, tripId);
  }

  async removeStop(userId: string, tripId: string, stopId: string): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    const deleted = await this.prisma.$transaction(async (tx) => {
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

    await this.enqueueRoute(tripId);
    return this.findOne(userId, tripId);
  }

  async addWaypoint(userId: string, tripId: string, dto: AddWaypointDto): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    await this.prisma.$transaction(async (tx) => {
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

    await this.enqueueRoute(tripId);
    return this.findOne(userId, tripId);
  }

  async removeWaypoint(userId: string, tripId: string, waypointId: string): Promise<Trip> {
    await this.ensureTripOwned(userId, tripId);

    const deleted = await this.prisma.$transaction(async (tx) => {
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

    await this.enqueueRoute(tripId);
    return this.findOne(userId, tripId);
  }

  // Enqueues a route computation for the trip. jobId is the trip id, so
  // concurrent enqueues (e.g. every lazy read) collapse into a single job; a
  // fresh job is created after a change or once the previous one completes.
  private enqueueRoute(tripId: string): Promise<unknown> {
    const data: ComputeRouteJobData = { tripId };
    return this.routeQueue.add('compute-route', data, {
      jobId: `route-${tripId}`,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    });
  }

  // The geography columns are PostGIS-only and unsupported by Prisma, so they
  // are written with raw SQL after the row is created/updated.
  private setGeographyPoints(tripId: string, origin: PlaceDto, destination: PlaceDto) {
    return this.prisma.$executeRaw`
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

  private async findOwnedTrip(userId: string, id: string): Promise<TripWithRelations> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId },
      include: {
        waypoints: { orderBy: { order: 'asc' } },
        tripStops: {
          orderBy: { order: 'asc' },
          include: { stop: true },
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
  tripStops: { order: number }[];
}): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    status: trip.status,
    origin: trip.originLabel,
    destination: trip.destLabel,
    stopCount: trip.tripStops.length,
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
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    totalDistanceMeters: trip.totalDistanceMeters,
    totalDurationSeconds: trip.totalDurationSeconds,
    encodedPolyline: trip.encodedPolyline,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}
