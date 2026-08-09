import { Controller, Get } from '@nestjs/common';
import type { User } from '@roadtrip4me/types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User as UserModel } from '../generated/prisma/client';

@Controller('users')
export class UsersController {
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
}
