import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserId } from '../auth/current-user.decorator';
import { PremiumGuard } from '../auth/premium.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationsService } from './recommendations.service';

type RecommendationStatus =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'failed'; message?: string }
  | { status: 'completed'; data: unknown };

@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller('trips')
export class RecommendationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @UseGuards(PremiumGuard)
  @Post(':tripId/recommendations')
  async request(
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: RecommendationRequestDto
  ): Promise<{ requestId: string; status: string }> {
    await this.ensureTripOwned(userId, tripId);

    // Check for existing request
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { tripId },
    });

    if (existing) {
      if (existing.status === 'processing' || existing.status === 'pending') {
        return { requestId: existing.id, status: existing.status };
      }
      // completed or failed — allow refresh
      await this.prisma.recommendationRequest.delete({ where: { id: existing.id } });
    }

    const req = await this.prisma.recommendationRequest.create({
      data: {
        tripId,
        status: 'processing',
      },
    });

    // Fire-and-forget background processing
    setImmediate(async () => {
      try {
        const stops = await this.recommendationsService.recommend(userId, tripId, dto);
        await this.prisma.recommendationRequest.update({
          where: { id: req.id },
          data: { status: 'completed', stops: JSON.parse(JSON.stringify(stops)) },
        });
      } catch (err) {
        await this.prisma.recommendationRequest.update({
          where: { id: req.id },
          data: {
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    });

    return { requestId: req.id, status: 'processing' };
  }

  @Get(':tripId/recommendations')
  async status(
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string
  ): Promise<RecommendationStatus> {
    await this.ensureTripOwned(userId, tripId);

    const req = await this.prisma.recommendationRequest.findUnique({
      where: { tripId },
    });

    if (!req) {
      return { status: 'idle' };
    }

    if (req.status === 'completed') {
      return { status: 'completed', data: req.stops };
    }
    if (req.status === 'failed') {
      const result: { status: 'failed'; message?: string } = { status: 'failed' };
      if (req.error) result.message = req.error;
      return result;
    }
    return { status: 'processing' };
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
}
