import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { StopsModule } from './stops/stops.module';
import { VotesModule } from './votes/votes.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { UsersModule } from './users/users.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.DATABASE_URL ? false : '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 300,
      },
    ]),
    PrismaModule,
    AuthModule,
    TripsModule,
    StopsModule,
    VotesModule,
    RecommendationsModule,
    UsersModule,
    AffiliateModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
