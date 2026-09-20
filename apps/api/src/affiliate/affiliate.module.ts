import { Module } from '@nestjs/common';
import { AccommodationsController, AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';
import { Stay22Provider } from './stay22.provider';
import { TravelpayoutsProvider } from './travelpayouts.provider';

@Module({
  controllers: [AffiliateController, AccommodationsController],
  providers: [AffiliateService, BookingProvider, ExpediaProvider, Stay22Provider, TravelpayoutsProvider],
})
export class AffiliateModule {}
