import { Module } from '@nestjs/common';
import { AccommodationsController, AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';

@Module({
  controllers: [AffiliateController, AccommodationsController],
  providers: [AffiliateService, BookingProvider, ExpediaProvider],
})
export class AffiliateModule {}
