import { Controller, Get, Param, Query } from '@nestjs/common';
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

@Controller('accommodations')
export class AccommodationsController {
  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * Hotels near a destination. `city` is required (e.g. "Chicago, IL"); the
   * coordinates are passed through to the live inventory API when configured.
   */
  @Get('nearby')
  nearby(
    @Query('city') city?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string
  ) {
    return this.affiliateService.getNearbyAccommodations(
      city,
      toFiniteNumber(lat),
      toFiniteNumber(lng)
    );
  }
}

function toFiniteNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}
