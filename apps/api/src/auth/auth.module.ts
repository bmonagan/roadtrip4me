import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PremiumGuard } from './premium.guard';

@Global()
@Module({
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    PremiumGuard,
  ],
  exports: [AuthService, PremiumGuard],
})
export class AuthModule {}
