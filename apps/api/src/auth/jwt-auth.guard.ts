import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User as UserModel } from '../generated/prisma/client';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = {
  user?: UserModel;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Global guard. For @Public() routes it only resolves the caller when a valid
 * credential is present (so responses can be personalized). For protected
 * routes it requires an authenticated user and attaches it to request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization =
      typeof request.headers['authorization'] === 'string'
        ? (request.headers['authorization'] as string)
        : undefined;
    const userId =
      typeof request.headers['x-user-id'] === 'string'
        ? (request.headers['x-user-id'] as string)
        : undefined;

    try {
      request.user = await this.authService.resolve(authorization, userId);
    } catch (error) {
      if (isPublic) {
        return true;
      }
      throw error;
    }

    if (!isPublic && !request.user) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
