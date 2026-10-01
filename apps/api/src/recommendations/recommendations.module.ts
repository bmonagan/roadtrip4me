import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { MapsModule } from '../maps/maps.module';
import { isDemoMode } from '../demo/demo';
import { DeepseekClient } from './deepseek.client';
import { DemoDeepseekClient } from './demo-deepseek.client';

@Module({
  imports: [MapsModule],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    {
      provide: DeepseekClient,
      // Chosen at provider-instantiation time so `.env` has been loaded.
      useFactory: (): DeepseekClient =>
        isDemoMode() ? new DemoDeepseekClient() : new DeepseekClient(),
    },
  ],
})
export class RecommendationsModule {}
