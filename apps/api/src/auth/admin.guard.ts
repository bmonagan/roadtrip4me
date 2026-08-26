import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Guard that enforces admin privileges for user-management endpoints.
 * Throws ForbiddenException if the user is not authenticated or not an admin.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }
    if (!request.user.isAdmin) {
      throw new ForbiddenException('Admin privileges required');
    }
    return true;
  }
}
