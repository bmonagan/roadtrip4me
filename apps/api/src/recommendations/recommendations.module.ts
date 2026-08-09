import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsProcessor } from './recommendations.processor';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'recommendations' }), MapsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationsProcessor],
})
export class RecommendationsModule {}
