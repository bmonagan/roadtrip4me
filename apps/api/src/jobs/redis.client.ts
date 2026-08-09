import { Redis } from 'ioredis';
import { redisConnection } from './redis.config';

let client: Redis | null = null;

/** Shared ioredis client (used by health checks and any direct Redis access). */
export function getRedisClient(): Redis {
  if (!client) {
    const { host, port } = redisConnection();
    client = new Redis({ host, port, lazyConnect: true, maxRetriesPerRequest: null });
  }
  return client;
}
