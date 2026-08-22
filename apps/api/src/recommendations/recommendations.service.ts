import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { decode } from '@googlemaps/polyline-codec';
import type { StopRecommendation } from '../types';
import type { Trip as TripModel } from '../generated/prisma/client';
import { distanceToRouteMeters, type GeoPoint } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService } from '../maps/google-maps.service';
import { deepseekJson } from './deepseek';
import { STOP_CATEGORIES, parseStops, type ParsedStop } from './parse';
import type { RecommendationRequestDto } from './dto/recommendation-request.dto';

export type RecommendedStop = StopRecommendation & { city: string; state: string };

const SYSTEM_PROMPT = `You are a road trip planner. Given a trip and its travel preferences, suggest the most worthwhile stops along the route. You MUST respond with valid JSON only, matching this exact shape:

{
  "stops": [
    {
      "name": "Stop name",
      "description": "1-2 sentence description",
      "category": "one of ${STOP_CATEGORIES.join(', ')}",
      "city": "City",
      "state": "Two-letter state or country code",
      "lat": approximate_latitude,
      "lng": approximate_longitude,
      "reasoning": "One sentence on why this stop fits the trip's vibes and preferences"
    }
  ]
}

Rules:
- Suggest 5-7 stops spread along the whole route, not clustered at the ends.
- Coordinates must be plausible real-world coordinates for the place.
- Favor stops that match the given vibes and preferences; respect maxDetourMinutes as a rough guide.
- Include a mix of categories unless vibes clearly call for one type.`;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maps: GoogleMapsService,
  ) {}

  async recommend(
    userId: string,
    tripId: string,
    dto: RecommendationRequestDto
  ): Promise<RecommendedStop[]> {
    const apiKey = process.env['DEEPSEEK_API_KEY'];
    if (!apiKey) {
      throw new BadGatewayException('DEEPSEEK_API_KEY is not configured');
    }

    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    const route = await this.buildRoute(trip);
    const raw = await deepseekJson(apiKey, SYSTEM_PROMPT, this.buildUserPrompt(trip, dto));
    const parsed = await this.enrichCoordinates(parseStops(raw));

    return parsed.map((stop) => ({
      name: stop.name,
      description: stop.description,
      coordinates: { lat: stop.lat, lng: stop.lng },
      category: stop.category,
      reasoning: stop.reasoning,
      distanceFromRouteMeters: Math.round(
        distanceToRouteMeters({ lat: stop.lat, lng: stop.lng }, route)
      ),
      city: stop.city,
      state: stop.state,
    }));
  }

  // LLM-provided coordinates are approximate. Reconcile each stop against the
  // Places API (best-effort, in parallel); fall back to the LLM values when a
  // lookup fails or the Places API isn't enabled.
  private async enrichCoordinates(stops: ParsedStop[]): Promise<ParsedStop[]> {
    return Promise.all(
      stops.map(async (stop) => {
        const query = `${stop.name}${stop.city ? `, ${stop.city}` : ''}${stop.state ? `, ${stop.state}` : ''}`;
        const coords = await this.maps.searchPlace(query);
        return coords ? { ...stop, lat: coords.lat, lng: coords.lng } : stop;
      })
    );
  }

  private async buildRoute(trip: TripModel): Promise<GeoPoint[]> {
    // Prefer the real driving route when available; fall back to the straight
    // origin → waypoints → destination line for trips without routing data.
    if (trip.encodedPolyline) {
      try {
        const points = decode(trip.encodedPolyline);
        if (points.length >= 2) {
          return points.map(([lat, lng]) => ({ lat, lng }));
        }
      } catch {
        // malformed polyline — fall through to the straight-line route
      }
    }

    const waypoints = await this.prisma.tripWaypoint.findMany({
      where: { tripId: trip.id },
      orderBy: { order: 'asc' },
    });
    return [
      { lat: trip.originLat, lng: trip.originLng },
      ...waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
      { lat: trip.destLat, lng: trip.destLng },
    ];
  }

  private buildUserPrompt(trip: TripModel, dto: RecommendationRequestDto): string {
    const vibes = dto.vibes && dto.vibes.length > 0 ? dto.vibes.join(', ') : 'any';
    const prefs = dto.preferences;
    const prefLines = [
      prefs.avoidHighways ? 'avoid highways' : 'highways are fine',
      prefs.preferNationalParks ? 'prefer national parks' : 'parks optional',
      prefs.foodPreferences.length > 0
        ? `food: ${prefs.foodPreferences.join(', ')}`
        : 'no food preference',
    ];

    return JSON.stringify({
      trip: trip.title,
      origin: `${trip.originLabel} (${trip.originLat}, ${trip.originLng})`,
      destination: `${trip.destLabel} (${trip.destLat}, ${trip.destLng})`,
      vibes,
      maxDetourMinutes: dto.maxDetourMinutes,
      preferences: prefLines.join('; '),
    });
  }
}

