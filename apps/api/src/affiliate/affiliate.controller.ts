import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AffiliateService } from './affiliate.service';

@Controller('trips')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get(':tripId/accommodations')
  accommodations(@CurrentUserId() userId: string, @Param('tripId') tripId: string) {
    return this.affiliateService.getAccommodations(userId, tripId);
  }
}
