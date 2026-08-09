import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsProcessor } from './recommendations.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'recommendations' })],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsProcessor],
})
export class RecommendationsModule {}
