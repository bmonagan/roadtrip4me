import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { decode } from '@googlemaps/polyline-codec';
import type { StopCategory, StopRecommendation } from '@roadtrip4me/types';
import type { Trip as TripModel } from '../generated/prisma/client';
import { distanceToRouteMeters, type GeoPoint } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';
import { deepseekJson } from './deepseek';
import type { RecommendationRequestDto } from './dto/recommendation-request.dto';

export type RecommendedStop = StopRecommendation & { city: string; state: string };

const STOP_CATEGORIES: StopCategory[] = [
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other',
];

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

interface ParsedStop {
  name: string;
  description: string;
  category: StopCategory;
  city: string;
  state: string;
  lat: number;
  lng: number;
  reasoning: string;
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const parsed = parseStops(raw);

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

function parseStops(raw: unknown): ParsedStop[] {
  const stops = Array.isArray((raw as { stops?: unknown })?.stops)
    ? (raw as { stops: unknown[] }).stops
    : [];

  const parsed: ParsedStop[] = [];
  for (const item of stops.slice(0, 10)) {
    const stop = parseStop(item);
    if (stop) parsed.push(stop);
  }
  return parsed;
}

function parseStop(raw: unknown): ParsedStop | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;

  const name = cleanString(s.name);
  const lat = cleanNumber(s.lat);
  const lng = cleanNumber(s.lng);
  const city = cleanString(s.city) ?? '';
  const state = cleanString(s.state) ?? '';
  if (!name || lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  const category = STOP_CATEGORIES.includes(s.category as StopCategory)
    ? (s.category as StopCategory)
    : 'other';

  return {
    name,
    description: cleanString(s.description) ?? name,
    category,
    city,
    state,
    lat,
    lng,
    reasoning: cleanString(s.reasoning) ?? '',
  };
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function cleanNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
