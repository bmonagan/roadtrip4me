import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { AffiliateService } from './affiliate.service';
import { TrackClickDto } from './dto/track-click.dto';

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
   * Public so the Stops page can show hotels to signed-out visitors.
   */
  @Public()
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

@Controller('affiliate')
export class AffiliateClickController {
  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * Records an outbound affiliate-card click. Public and fire-and-forget: the
   * web fires it alongside opening the link, and a failure must never block the
   * user's navigation, so it always returns 204.
   */
  @Public()
  @Post('click')
  @HttpCode(204)
  async click(@Body() dto: TrackClickDto): Promise<void> {
    await this.affiliateService.recordClick(dto);
  }
}
