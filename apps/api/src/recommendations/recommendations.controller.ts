import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, CurrentUserId } from '../auth/current-user.decorator';
import { PremiumGuard } from '../auth/premium.guard';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';
import { RecommendationsService } from './recommendations.service';

type RecommendationStatus =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'failed'; message?: string }
  | { status: 'completed'; data: unknown };

// Per-user daily budget on AI recommendation runs (DeepSeek + Places calls are
// paid). The counter resets automatically when the local day rolls over.
const DAILY_RECOMMENDATION_LIMIT = 10;

// A processing/pending request older than this is assumed orphaned (the
// in-process job died on a restart). It's treated as retryable so the trip
// isn't blocked forever.
const STALE_JOB_MS = 10 * 60 * 1000;

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
    @CurrentUser() user: UserModel,
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: RecommendationRequestDto
  ): Promise<{ requestId: string; status: string }> {
    await this.ensureTripOwned(userId, tripId);
    await this.consumeDailyBudget(user);

    // Check for existing request
    const existing = await this.prisma.recommendationRequest.findUnique({
      where: { tripId },
    });

    if (existing) {
      const isInFlight =
        existing.status === 'processing' || existing.status === 'pending';
      const isStale =
        isInFlight &&
        Date.now() - existing.updatedAt.getTime() > STALE_JOB_MS;
      if (isInFlight && !isStale) {
        return { requestId: existing.id, status: existing.status };
      }
      // completed, failed, or stale — allow refresh
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

  // Enforces the per-user daily budget, atomically resetting the counter when
  // the day changes. Throws when the user is out of budget.
  private async consumeDailyBudget(user: UserModel): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfCount =
      user.recommendationCountDay instanceof Date
        ? new Date(user.recommendationCountDay)
        : null;
    const sameDay =
      dayOfCount !== null &&
      dayOfCount.getTime() === today.getTime();

    const nextCount = sameDay ? user.recommendationCount + 1 : 1;
    if (nextCount > DAILY_RECOMMENDATION_LIMIT) {
      throw new ForbiddenException(
        `You've reached your daily limit of ${DAILY_RECOMMENDATION_LIMIT} AI recommendation runs. Try again tomorrow.`
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        recommendationCount: nextCount,
        recommendationCountDay: sameDay ? user.recommendationCountDay : today,
      },
    });
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
    // pending/processing: report stale jobs as failed so the client can retry.
    if (Date.now() - req.updatedAt.getTime() > STALE_JOB_MS) {
      return { status: 'failed', message: 'Recommendation job timed out. Try again.' };
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
