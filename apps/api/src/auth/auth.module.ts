import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PremiumGuard } from './premium.guard';
import { AdminGuard } from './admin.guard';

@Global()
@Module({
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      // Global rate limiting. ThrottlerModule is configured in AppModule; per
      // controller/route @Throttle decorators override the global 300/min.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    PremiumGuard,
    AdminGuard,
  ],
  exports: [AuthService, PremiumGuard, AdminGuard],
})
export class AuthModule {}
