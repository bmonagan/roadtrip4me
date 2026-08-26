import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import type { User } from '../types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../auth/admin.guard';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  createdAt: string;
}

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
      isAdmin: user.isAdmin,
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

  // ─── Admin ────────────────────────────────────────────────────────────────

  @UseGuards(AdminGuard)
  @Get('admin')
  async adminList(): Promise<AdminUserView[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return users.map(toAdminView);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  async adminUpdate(
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto
  ): Promise<AdminUserView> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(typeof body.isPremium === 'boolean' && { isPremium: body.isPremium }),
        ...(typeof body.isAdmin === 'boolean' && { isAdmin: body.isAdmin }),
      },
    });
    return toAdminView(user);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/:id')
  async adminDelete(@Param('id') id: string): Promise<{ deleted: true }> {
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }
}

function toAdminView(user: UserModel): AdminUserView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPremium: user.isPremium,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt.toISOString(),
  };
}
