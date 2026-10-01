import { BadGatewayException, Injectable } from '@nestjs/common';
import { deepseekJson } from './deepseek';

/**
 * Injectable wrapper around the raw DeepSeek call so demo mode can swap in a
 * canned response without touching the recommendation business logic.
 */
@Injectable()
export class DeepseekClient {
  async json(system: string, user: string): Promise<unknown> {
    const apiKey = process.env['DEEPSEEK_API_KEY'];
    if (!apiKey) {
      throw new BadGatewayException('DEEPSEEK_API_KEY is not configured');
    }
    return deepseekJson(apiKey, system, user);
  }
}
