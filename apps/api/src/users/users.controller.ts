import { Controller, Delete, Get } from '@nestjs/common';
import type { User } from '../types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser() user: UserModel): User {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      isPremium: user.isPremium,
    };
  }

  // "Right to be forgotten": deletes the account and all owned data. Related
  // rows cascade (trips, votes, saved stops, collaborations); community stops
  // they submitted are kept but unlinked (submittedByUserId -> null).
  @Delete('me')
  async deleteMe(@CurrentUser() user: UserModel): Promise<{ deleted: true }> {
    await this.prisma.user.delete({ where: { id: user.id } });
    return { deleted: true };
  }
}
