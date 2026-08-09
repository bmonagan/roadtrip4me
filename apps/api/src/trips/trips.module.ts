import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { MapsModule } from '../maps/maps.module';
import { RouteProcessor } from '../jobs/route.processor';

@Module({
  imports: [MapsModule, BullModule.registerQueue({ name: 'route' })],
  controllers: [TripsController],
  providers: [TripsService, RouteProcessor],
})
export class TripsModule {}
