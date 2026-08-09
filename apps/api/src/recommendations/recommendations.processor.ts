import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RecommendationsService, type RecommendedStop } from './recommendations.service';
import type { RecommendationRequestDto } from './dto/recommendation-request.dto';

export interface GenerateRecommendationsJobData {
  userId: string;
  tripId: string;
  dto: RecommendationRequestDto;
}

// Calls DeepSeek to generate stop recommendations off the request path. The
// resulting RecommendedStop[] becomes the job's return value, read back by
// the status endpoint.
@Processor('recommendations')
export class RecommendationsProcessor extends WorkerHost {
  constructor(private readonly recommendationsService: RecommendationsService) {
    super();
  }

  async process(job: Job<GenerateRecommendationsJobData>): Promise<RecommendedStop[]> {
    const { userId, tripId, dto } = job.data;
    return this.recommendationsService.recommend(userId, tripId, dto);
  }
}
