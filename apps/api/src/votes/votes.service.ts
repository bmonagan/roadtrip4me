import { Injectable, NotFoundException } from '@nestjs/common';
import type { StopWithUserVote } from '@roadtrip4me/types';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mapStop } from '../common/mappers/stop.mapper';

@Injectable()
export class VotesService {
  constructor(private readonly prisma: PrismaService) {}

  async cast(userId: string, stopId: string, value: 1 | -1): Promise<StopWithUserVote> {
    await this.ensureStopExists(stopId);

    await this.prisma.$transaction(async (tx) => {
      // One vote per user per stop: upsert on the unique (userId, stopId) so
      // casting again simply flips the vote direction instead of inserting a row.
      await tx.vote.upsert({
        where: { userId_stopId: { userId, stopId } },
        update: { value },
        create: { userId, stopId, value },
      });
      await this.recalculateScore(tx, stopId);
    });

    return this.getStopWithUserVote(stopId, userId);
  }

  async remove(userId: string, stopId: string): Promise<{ deleted: true }> {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.vote.deleteMany({ where: { userId, stopId } });
      if (result.count > 0) {
        await this.recalculateScore(tx, stopId);
      }
      return result;
    });

    if (deleted.count === 0) {
      throw new NotFoundException('Vote not found');
    }

    return { deleted: true };
  }

  private async ensureStopExists(stopId: string): Promise<void> {
    const stop = await this.prisma.stop.findUnique({ where: { id: stopId }, select: { id: true } });
    if (!stop) {
      throw new NotFoundException(`Stop ${stopId} not found`);
    }
  }

  // Keep the denormalized score/voteCount columns on stops in sync. Never
  // aggregate at read time — always read these cached columns.
  private async recalculateScore(tx: Prisma.TransactionClient, stopId: string): Promise<void> {
    const agg = await tx.vote.aggregate({
      where: { stopId },
      _sum: { value: true },
      _count: { value: true },
    });

    await tx.stop.update({
      where: { id: stopId },
      data: { score: agg._sum.value ?? 0, voteCount: agg._count.value },
    });
  }

  private async getStopWithUserVote(stopId: string, userId: string): Promise<StopWithUserVote> {
    const [stop, vote] = await this.prisma.$transaction([
      this.prisma.stop.findUniqueOrThrow({ where: { id: stopId } }),
      this.prisma.vote.findUnique({
        where: { userId_stopId: { userId, stopId } },
        select: { value: true },
      }),
    ]);

    return { ...mapStop(stop), userVote: (vote?.value as 1 | -1) ?? null };
  }
}
