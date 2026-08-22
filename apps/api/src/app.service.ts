import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<HealthResult> {
    const db = await this.checkDb();
    return {
      status: db ? 'ok' : 'degraded',
      db: db ? 'up' : 'down',
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
}
