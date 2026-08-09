import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { GoogleMapsService, type RouteResult } from '../maps/google-maps.service';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { ListTripsQueryDto } from './dto/list-trips-query.dto';
import type { PlaceDto } from './dto/create-trip.dto';
import type { UpdateTripDto } from './dto/update-trip.dto';

type TripWithRelations = TripModel & {
  waypoints: TripWaypointModel[];
  tripStops: (TripStopModel & { stop: StopModel })[];
};

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly maps: GoogleMapsService
  ) {}

  async create(userId: string, dto: CreateTripDto): Promise<Trip> {
    const route = await this.fetchRoute(
      { lat: dto.origin.lat, lng: dto.origin.lng },
      { lat: dto.destination.lat, lng: dto.destination.lng },
      []
    );

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
        ...(route !== null && {
          encodedPolyline: route.encodedPolyline,
          totalDistanceMeters: route.distanceMeters,
          totalDurationSeconds: route.durationSeconds,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.vibes !== undefined && { vibes: dto.vibes }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      },
    });

    await this.setGeographyPoints(trip.id, dto.origin, dto.destination);

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
    // Attempt at most once per request so a failed/unavailable route can't loop.
    if (!trip.encodedPolyline) {
      await this.refreshRoute(trip);
      const refreshed = await this.findOwnedTrip(userId, id);
      return toTrip(refreshed);
    }

    return toTrip(trip);
  }

  async update(userId: string, id: string, dto: UpdateTripDto): Promise<Trip> {
    const trip = await this.findOwnedTrip(userId, id);

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

      const refreshed = await this.findOwnedTrip(userId, id);
      await this.refreshRoute(refreshed);
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

    await this.refreshRoute(await this.findOwnedTrip(userId, tripId));
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

    await this.refreshRoute(await this.findOwnedTrip(userId, tripId));
    return this.findOne(userId, tripId);
  }

  // Fetches a driving route that passes through the trip's ordered stops and
  // persists the polyline + aggregates. Failures are logged, never thrown, so
  // trip operations still succeed when routing is unavailable.
  private async refreshRoute(trip: TripWithRelations): Promise<void> {
    const intermediates = trip.tripStops.map((ts) => ({ lat: ts.stop.lat, lng: ts.stop.lng }));
    const route = await this.fetchRoute(
      { lat: trip.originLat, lng: trip.originLng },
      { lat: trip.destLat, lng: trip.destLng },
      intermediates
    );

    if (route !== null) {
      await this.prisma.trip.update({
        where: { id: trip.id },
        data: {
          encodedPolyline: route.encodedPolyline,
          totalDistanceMeters: route.distanceMeters,
          totalDurationSeconds: route.durationSeconds,
        },
      });
    }
  }

  private async fetchRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    intermediates: { lat: number; lng: number }[]
  ): Promise<RouteResult | null> {
    try {
      return await this.maps.getRoute(origin, destination, intermediates);
    } catch (error) {
      this.logger.warn(`Route computation failed: ${(error as Error).message}`);
      return null;
    }
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
