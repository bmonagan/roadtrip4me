import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService, type HealthResult } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  health(): Promise<HealthResult> {
    return this.appService.health();
  }

  // Readiness probe — returns 503 when a dependency is down so orchestrators
  // can avoid routing traffic to a half-booted instance.
  @Public()
  @Get('ready')
  async ready(): Promise<HealthResult> {
    const result = await this.appService.health();
    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
