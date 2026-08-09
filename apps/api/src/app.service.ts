import { Injectable } from '@nestjs/common';
import { getRedisClient } from './jobs/redis.client';
import { PrismaService } from './prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  redis: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<HealthResult> {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    return {
      status: db && redis ? 'ok' : 'degraded',
      db: db ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await getRedisClient().ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
