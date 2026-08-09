export interface RedisConnection {
  host: string;
  port: number;
}

export function redisConnection(): RedisConnection {
  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}
