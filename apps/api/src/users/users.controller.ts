import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import type { PaginatedResponse, User } from '@roadtrip4me/types';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from '../auth/admin.guard';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';

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
  async adminList(
    @Query() query: AdminListUsersQueryDto
  ): Promise<PaginatedResponse<AdminUserView>> {
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      data: users.map(toAdminView),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: query.page * query.pageSize < total,
    };
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  async adminUpdate(
    @CurrentUser() actor: UserModel,
    @Param('id') id: string,
    @Body() body: AdminUpdateUserDto
  ): Promise<AdminUserView> {
    // Prevent an admin from removing their own admin role.
    if (actor.id === id && body.isAdmin === false) {
      throw new BadRequestException('You cannot remove your own admin role');
    }
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
  async adminDelete(
    @CurrentUser() actor: UserModel,
    @Param('id') id: string
  ): Promise<{ deleted: true }> {
    // Prevent an admin from deleting their own account through this endpoint.
    if (actor.id === id) {
      throw new BadRequestException('You cannot delete your own account here');
    }
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
