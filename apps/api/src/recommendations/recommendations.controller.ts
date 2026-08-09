import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';

type RecommendationStatus =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'failed'; message?: string }
  | { status: 'completed'; data: unknown };

@Controller('trips')
export class RecommendationsController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('recommendations') private readonly recommendationsQueue: Queue
  ) {}

  @Post(':tripId/recommendations')
  async enqueue(
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: RecommendationRequestDto
  ): Promise<{ jobId: string; status: string }> {
    await this.ensureTripOwned(userId, tripId);

    const jobId = `recommendations-${tripId}`;
    const existing = await this.recommendationsQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        return { jobId, status: state };
      }
      if (state === 'completed') {
        // Re-request means refresh — drop the completed job so a fresh one runs.
        await existing.remove();
      }
    }

    const job = await this.recommendationsQueue.add(
      'generate-recommendations',
      { userId, tripId, dto },
      {
        jobId,
        removeOnComplete: { count: 5 },
        removeOnFail: { count: 10 },
      }
    );

    return { jobId: job.id!, status: 'queued' };
  }

  @Get(':tripId/recommendations')
  async status(
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string
  ): Promise<RecommendationStatus> {
    await this.ensureTripOwned(userId, tripId);

    const job = await this.recommendationsQueue.getJob(`recommendations-${tripId}`);
    if (!job) {
      return { status: 'idle' };
    }

    const state = await job.getState();
    if (state === 'completed') {
      return { status: 'completed', data: job.returnvalue };
    }
    if (state === 'failed') {
      return { status: 'failed', message: job.failedReason ?? undefined };
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
