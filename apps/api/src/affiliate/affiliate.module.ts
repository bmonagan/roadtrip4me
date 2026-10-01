import { Module } from '@nestjs/common';
import {
  AccommodationsController,
  AffiliateClickController,
  AffiliateController,
} from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { DemoAffiliateService } from './demo-affiliate.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';
import { Stay22Provider } from './stay22.provider';
import { TravelpayoutsProvider } from './travelpayouts.provider';
import { PrismaService } from '../prisma/prisma.service';
import { isDemoMode } from '../demo/demo';

@Module({
  controllers: [
    AffiliateController,
    AccommodationsController,
    AffiliateClickController,
  ],
  providers: [
    BookingProvider,
    ExpediaProvider,
    Stay22Provider,
    TravelpayoutsProvider,
    {
      provide: AffiliateService,
      // Chosen at provider-instantiation time so `.env` has been loaded.
      useFactory: (
        prisma: PrismaService,
        booking: BookingProvider,
        expedia: ExpediaProvider,
        stay22: Stay22Provider,
        travelpayouts: TravelpayoutsProvider
      ): AffiliateService =>
        isDemoMode()
          ? new DemoAffiliateService(prisma, booking, expedia, stay22, travelpayouts)
          : new AffiliateService(prisma, booking, expedia, stay22, travelpayouts),
      inject: [
        PrismaService,
        BookingProvider,
        ExpediaProvider,
        Stay22Provider,
        TravelpayoutsProvider,
      ],
    },
  ],
})
export class AffiliateModule {}
