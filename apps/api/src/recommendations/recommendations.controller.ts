import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { RecommendationsService } from './recommendations.service';
import { RecommendationRequestDto } from './dto/recommendation-request.dto';

@Controller('trips')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Post(':tripId/recommendations')
  recommend(
    @CurrentUserId() userId: string,
    @Param('tripId') tripId: string,
    @Body() dto: RecommendationRequestDto
  ) {
    return this.recommendationsService.recommend(userId, tripId, dto);
  }
}
