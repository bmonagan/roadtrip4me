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
  name?: string | null;
  picture?: string | null;
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
      return this.resolveAccount(verified);
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
    if (!domain) {
      throw new UnauthorizedException('Auth is not configured');
    }

    // Auth0 issues opaque tokens (valid for /userinfo) when no audience is
    // requested, and JWT access tokens when a custom API audience is used.
    // Detect the format and validate accordingly.
    const looksLikeJwt = token.split('.').length === 3;
    return looksLikeJwt
      ? this.verifyJwt(token, domain)
      : this.verifyOpaque(token, domain);
  }

  private async verifyJwt(token: string, domain: string): Promise<VerifiedToken> {
    const audience = process.env['AUTH0_AUDIENCE'];
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
        name: typeof payload.name === 'string' ? payload.name : null,
        picture: typeof payload.picture === 'string' ? payload.picture : null,
      };
    } catch (error) {
      this.logger.warn(`Token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Validates an opaque Auth0 access token against the /userinfo endpoint and
   * resolves the returned profile. Opaque tokens cannot be verified locally, so
   * Auth0 itself confirms validity by returning the associated user claims.
   *
   * Results are cached briefly in memory to avoid an external round-trip on
   * every request. Cache entries have no expiry benefit beyond the 24h token
   * lifetime, so a short TTL keeps revocation latency low while cutting call
   * volume dramatically for bursty traffic.
   */
  private static readonly USERINFO_TTL_MS = 60_000;
  private static readonly USERINFO_CACHE_MAX = 10_000;
  private readonly userinfoCache = new Map<string, { at: number; data: VerifiedToken }>();

  private async verifyOpaque(token: string, domain: string): Promise<VerifiedToken> {
    const cached = this.userinfoCache.get(token);
    if (cached && Date.now() - cached.at < AuthService.USERINFO_TTL_MS) {
      return cached.data;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(`https://${domain}/userinfo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        this.logger.warn(`userinfo failed: ${res.status}`);
        throw new UnauthorizedException('Invalid or expired token');
      }
      const profile = (await res.json()) as Record<string, unknown>;
      const authId = typeof profile.sub === 'string' ? profile.sub : null;
      if (!authId) {
        throw new UnauthorizedException('Token has no subject');
      }
      const data: VerifiedToken = {
        authId,
        email: typeof profile.email === 'string' ? profile.email : null,
        name: typeof profile.name === 'string' ? profile.name : null,
        picture: typeof profile.picture === 'string' ? profile.picture : null,
      };
      this.userinfoCache.set(token, { at: Date.now(), data });
      // Keep the cache bounded — drop the oldest entries when it grows too big.
      if (this.userinfoCache.size > AuthService.USERINFO_CACHE_MAX) {
        const oldest = this.userinfoCache.keys().next().value;
        if (oldest) this.userinfoCache.delete(oldest);
      }
      return data;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`userinfo request failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Resolves a verified token to a User row, provisioning the account on first
   * login: look up by authId first; otherwise link by email (adopting the new
   * sub); otherwise create a new User. Requires an email claim to provision.
   */
  private async resolveAccount(verified: VerifiedToken): Promise<UserModel> {
    const existing = await this.prisma.user.findUnique({
      where: { authId: verified.authId },
    });
    if (existing) return existing;

    if (verified.email) {
      const linked = await this.prisma.user.findUnique({
        where: { email: verified.email },
      });
      if (linked) {
        return this.prisma.user.update({
          where: { id: linked.id },
          data: { authId: verified.authId },
        });
      }
      return this.prisma.user.create({
        data: {
          authId: verified.authId,
          email: verified.email,
          displayName:
            verified.name || verified.email.split('@')[0] || verified.authId,
          avatarUrl: verified.picture ?? null,
        },
      });
    }

    throw new UnauthorizedException('Account not found');
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
    this.userinfoCache.clear();
  }
}
