import { describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PremiumGuard } from './premium.guard';

function moduleProviders() {
  const providers = Reflect.getMetadata('providers', AuthModule) as unknown[];
  return providers ?? [];
}

describe('AuthModule global guards', () => {
  it('registers both JwtAuthGuard and ThrottlerGuard as APP_GUARD', () => {
    const guards = moduleProviders().filter(
      (p) => (p as { provide: unknown }).provide === APP_GUARD
    ) as { provide: typeof APP_GUARD; useClass: unknown }[];

    expect(guards).toHaveLength(2);
    const classes = guards.map((g) => g.useClass);
    expect(classes).toContain(JwtAuthGuard);
    expect(classes).toContain(ThrottlerGuard);
  });

  it('provides PremiumGuard', () => {
    const premium = moduleProviders().find((p) => p === PremiumGuard);
    expect(premium).toBeDefined();
  });
});
