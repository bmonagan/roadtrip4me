import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Guard that enforces premium subscription.
 * Throws ForbiddenException if the user is not authenticated or not premium.
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }
    if (!request.user.isPremium) {
      throw new ForbiddenException('Premium subscription required');
    }
    return true;
  }
}
