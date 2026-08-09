import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService } from '../maps/google-maps.service';

export interface ComputeRouteJobData {
  tripId: string;
}

// Computes a driving route for a trip (passing through its ordered stops) and
// persists the polyline + aggregates. Runs off the request path so trip
// mutations return immediately.
@Processor('route')
export class RouteProcessor extends WorkerHost {
  private readonly logger = new Logger(RouteProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly maps: GoogleMapsService
  ) {
    super();
  }

  async process(job: Job<ComputeRouteJobData>): Promise<void> {
    const { tripId } = job.data;

    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        tripStops: {
          orderBy: { order: 'asc' },
          include: { stop: true },
        },
      },
    });
    if (!trip) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const route = await this.maps.getRoute(
      { lat: trip.originLat, lng: trip.originLng },
      { lat: trip.destLat, lng: trip.destLng },
      trip.tripStops.map((ts) => ({ lat: ts.stop.lat, lng: ts.stop.lng }))
    );

    if (route) {
      await this.prisma.trip.update({
        where: { id: tripId },
        data: {
          encodedPolyline: route.encodedPolyline,
          totalDistanceMeters: route.distanceMeters,
          totalDurationSeconds: route.durationSeconds,
        },
      });
    } else {
      this.logger.warn(`No drivable route found for trip ${tripId}`);
    }
  }
}
