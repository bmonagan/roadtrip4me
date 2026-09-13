import { Body, Controller, ForbiddenException, Get, Logger, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, CurrentUserId } from '../auth/current-user.decorator';
import { PremiumGuard } from '../auth/premium.guard';
import type { Prisma, User as UserModel } from '../generated/prisma/client';
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
  private readonly logger = new Logger(RecommendationsController.name);

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

    // Check for existing request BEFORE consuming budget: a request that is
    // still running (deduped early return below) shouldn't spend the user's
    // daily allowance for nothing.
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
      // completed, failed, or stale — refresh below.
    }

    await this.consumeDailyBudget(user);

    // Serialize refreshes per trip (mirrors TripsService) so a concurrent
    // request can't race the delete+create into the unique (tripId)
    // constraint. A losing in-flight job finds its row deleted and stops.
    const req = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId} FOR UPDATE`;
      const current = await tx.recommendationRequest.findUnique({
        where: { tripId },
      });
      if (current) {
        await tx.recommendationRequest.delete({ where: { id: current.id } });
      }
      return tx.recommendationRequest.create({
        data: { tripId, status: 'processing' },
      });
    });

    // Fire-and-forget background processing with a few retries on transient
    // failures (DeepSeek/Places are paid, so a flaky call shouldn't burn the
    // user's daily budget for nothing).
    setImmediate(async () => {
      const MAX_ATTEMPTS = 3;
      let lastError: unknown;
      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          try {
            const stops = await this.recommendationsService.recommend(userId, tripId, dto);
            await this.updateRequestQuietly(req.id, {
              status: 'completed',
              stops: JSON.parse(JSON.stringify(stops)),
            });
            return;
          } catch (err) {
            lastError = err;
            // If this job was superseded (a newer request deleted its row),
            // stop retrying so a dead job doesn't burn more paid calls.
            const stillExists = await this.prisma.recommendationRequest.findUnique({
              where: { id: req.id },
              select: { id: true },
            });
            if (!stillExists) return;
            if (attempt < MAX_ATTEMPTS - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, 1_000 * 2 ** attempt)
              );
            }
          }
        }
        await this.updateRequestQuietly(req.id, {
          status: 'failed',
          error: lastError instanceof Error ? lastError.message : String(lastError),
        });
      } catch (err) {
        this.logger.error(
          `Recommendation job ${req.id} failed: ${(err as Error).message}`
        );
      }
    });

    return { requestId: req.id, status: 'processing' };
  }

  // Enforces the per-user daily budget atomically: a single conditional UPDATE
  // increments the counter (resetting on a new day) under the row lock, and
  // only matches when the resulting count is within the limit. Concurrent
  // requests can't both read the same count and exceed the cap.
  private async consumeDailyBudget(user: UserModel): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ recommendationCount: number }[]>`
      UPDATE users
      SET
        "recommendationCount" = CASE
          WHEN "recommendationCountDay" = ${today}::date THEN "recommendationCount" + 1
          ELSE 1
        END,
        "recommendationCountDay" = ${today}::date
      WHERE id = ${user.id}
        AND (
          "recommendationCountDay" IS NULL
          OR "recommendationCountDay" <> ${today}::date
          OR "recommendationCount" < ${DAILY_RECOMMENDATION_LIMIT}
        )
      RETURNING "recommendationCount"
    `;

    if (rows.length === 0) {
      throw new ForbiddenException(
        `You've reached your daily limit of ${DAILY_RECOMMENDATION_LIMIT} AI recommendation runs. Try again tomorrow.`
      );
    }
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

  // Update the job row, swallowing P2025 (row already deleted by a newer
  // request) so a superseded job can't throw an unhandled rejection.
  private async updateRequestQuietly(
    id: string,
    data: Prisma.RecommendationRequestUpdateInput,
  ): Promise<void> {
    try {
      await this.prisma.recommendationRequest.update({ where: { id }, data });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2025') throw error;
    }
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
