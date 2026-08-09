import { Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

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
    }

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const trip = await this.findOwnedTrip(userId, id);
    await this.prisma.trip.delete({ where: { id: trip.id } });
    return { deleted: true };
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
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}
