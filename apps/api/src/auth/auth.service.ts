import {
  Injectable,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import * as jose from 'jose';
import type { User as UserModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface VerifiedToken {
  authId: string;
  email?: string | null;
}

/**
 * Verifies Auth0 access tokens (RS256 via the tenant's JWKS) and resolves the
 * token's `sub` claim to a User row. When auth is disabled (local dev), the
 * caller's `x-user-id` header is trusted instead — see AuthService.resolve().
 */
@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private jwks: jose.JWTVerifyGetKey | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get authEnabled(): boolean {
    return process.env['AUTH_DISABLED'] !== 'true' && Boolean(process.env['AUTH0_DOMAIN']);
  }

  async resolve(rawAuth: string | undefined, userId?: string): Promise<UserModel> {
    if (this.authEnabled) {
      const token = this.extractBearer(rawAuth);
      const verified = await this.verifyToken(token);
      const user = await this.prisma.user.findUnique({ where: { authId: verified.authId } });
      if (!user) {
        throw new UnauthorizedException('Account not found');
      }
      return user;
    }

    // Local dev fallback: trust the x-user-id header.
    if (!userId) {
      throw new UnauthorizedException('Missing user identifier');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Unknown user');
    }
    return user;
  }

  private extractBearer(rawAuth: string | undefined): string {
    if (!rawAuth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return rawAuth.slice('Bearer '.length);
  }

  private async verifyToken(token: string): Promise<VerifiedToken> {
    const domain = process.env['AUTH0_DOMAIN'];
    const audience = process.env['AUTH0_AUDIENCE'];
    if (!domain) {
      throw new UnauthorizedException('Auth is not configured');
    }

    try {
      const { payload } = await jose.jwtVerify(token, await this.getJwks(), {
        issuer: `https://${domain}/`,
        ...(audience ? { audience } : {}),
      });
      const authId = typeof payload.sub === 'string' ? payload.sub : null;
      if (!authId) {
        throw new UnauthorizedException('Token has no subject');
      }
      return {
        authId,
        email: typeof payload.email === 'string' ? payload.email : null,
      };
    } catch (error) {
      this.logger.warn(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private getJwks(): Promise<jose.JWTVerifyGetKey> {
    if (this.jwks) return Promise.resolve(this.jwks);
    const domain = process.env['AUTH0_DOMAIN']!;
    const url = `https://${domain}/.well-known/jwks.json`;
    this.jwks = jose.createRemoteJWKSet(new URL(url));
    return Promise.resolve(this.jwks);
  }

  async onModuleDestroy() {
    this.jwks = null;
  }
}
