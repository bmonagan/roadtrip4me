import { Injectable } from '@nestjs/common';
import { demoRecommendationResponse } from '../demo/demo-data';
import { DeepseekClient } from './deepseek.client';

/**
 * Demo replacement for {@link DeepseekClient} that returns a fixed set of
 * Route 66 stops instead of calling the paid API.
 */
@Injectable()
export class DemoDeepseekClient extends DeepseekClient {
  override async json(): Promise<unknown> {
    return demoRecommendationResponse();
  }
}
