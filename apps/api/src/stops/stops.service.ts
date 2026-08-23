import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResponse, Stop, StopWithUserVote } from '../types';
import { Prisma, type Stop as StopModel } from '../generated/prisma/client';
import { mapStop } from '../common/mappers/stop.mapper';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateStopDto } from './dto/create-stop.dto';
import type { ListStopsQueryDto } from './dto/list-stops-query.dto';
import type { NearbyStopsQueryDto } from './dto/nearby-stops-query.dto';

export type StopWithDistance = Stop & { distanceMeters: number };

type NearbyStopRow = StopModel & { distanceMeters: number };

@Injectable()
export class StopsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListStopsQueryDto): Promise<PaginatedResponse<Stop>> {
    const where: Prisma.StopWhereInput = {
      ...(query.category !== undefined && { category: query.category }),
      ...(query.city !== undefined && { city: query.city }),
      ...(query.q !== undefined && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { city: { contains: query.q, mode: 'insensitive' } },
          { state: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, stops] = await this.prisma.$transaction([
      this.prisma.stop.count({ where }),
      this.prisma.stop.findMany({
        where,
        orderBy: { score: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      data: stops.map(mapStop),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: query.page * query.pageSize < total,
    };
  }

  // PostGIS spatial query: points within radiusMeters of (lat, lng), sorted by
  // distance. Uses the GIST index on stops.location (ST_DWithin). The geography
  // column itself can't be returned by Prisma, so only flat columns are selected.
  async findNearby(query: NearbyStopsQueryDto): Promise<StopWithDistance[]> {
    const { lat, lng, radiusMeters, limit } = query;

    const rows = await this.prisma.$queryRaw<NearbyStopRow[]>`
      SELECT
        "id", "name", "description", "category", "imageUrl",
        "lat", "lng", "street", "city", "state", "country", "postalCode",
        "externalId", "externalSource", "score", "voteCount",
        "submittedByUserId", "createdAt", "updatedAt",
        ST_Distance(
          location,
          ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)::geography
        ) AS "distanceMeters"
      FROM stops
      WHERE ST_DWithin(
        location,
        ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)::geography,
        ${radiusMeters}
      )
      ORDER BY "distanceMeters"
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ ...mapStop(row), distanceMeters: Number(row.distanceMeters) }));
  }

  async findOne(id: string, userId?: string): Promise<StopWithUserVote> {
    const stop = await this.prisma.stop.findUnique({ where: { id } });
    if (!stop) {
      throw new NotFoundException(`Stop ${id} not found`);
    }

    const userVote = userId
      ? await this.prisma.vote.findUnique({
          where: { userId_stopId: { userId, stopId: id } },
          select: { value: true },
        })
      : null;

    return { ...mapStop(stop), userVote: (userVote?.value as 1 | -1) ?? null };
  }

  async create(userId: string, dto: CreateStopDto): Promise<Stop> {
    // Insert the row and set the PostGIS geography column in one transaction so
    // a failed spatial write can't leave a committed stop with a NULL location.
    return this.prisma.$transaction(async (tx) => {
      const stop = await tx.stop.create({
        data: {
          name: dto.name,
          category: dto.category,
          lat: dto.coordinates.lat,
          lng: dto.coordinates.lng,
          city: dto.address.city,
          state: dto.address.state,
          submittedByUserId: userId,
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.address.street !== undefined && { street: dto.address.street }),
          ...(dto.address.country !== undefined && { country: dto.address.country }),
          ...(dto.address.postalCode !== undefined && { postalCode: dto.address.postalCode }),
        },
      });

      await tx.$executeRaw`
        UPDATE stops SET
          location = ST_SetSRID(ST_Point(${dto.coordinates.lng}, ${dto.coordinates.lat}), 4326)::geography
        WHERE id = ${stop.id}
      `;

      return stop;
    }).then((stop) => mapStop(stop));
  }
}
