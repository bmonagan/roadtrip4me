import { Module } from '@nestjs/common';
import { isDemoMode } from '../demo/demo';
import { DemoGoogleMapsService } from './demo-google-maps.service';
import { GoogleMapsService } from './google-maps.service';

@Module({
  providers: [
    {
      provide: GoogleMapsService,
      // Chosen at provider-instantiation time so `.env` has been loaded.
      useFactory: (): GoogleMapsService =>
        isDemoMode() ? new DemoGoogleMapsService() : new GoogleMapsService(),
    },
  ],
  exports: [GoogleMapsService],
})
export class MapsModule {}
