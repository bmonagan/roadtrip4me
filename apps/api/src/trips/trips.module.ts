import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [MapsModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
