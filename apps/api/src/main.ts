import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

function corsOrigins(): string | string[] {
  const raw = process.env['CORS_ORIGIN'];
  if (!raw || raw.trim() === '*') return '*';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// CSP tuned for the SPA: Mapbox styles/tiles/geocoding, plus the API origin.
function contentSecurityPolicy(): string {
  const apiOrigin = process.env['VITE_API_URL'] ?? '';
  const connect = ['\'self\'', 'https://api.mapbox.com', 'https://*.mapbox.com', 'https://events.mapbox.com'];
  if (apiOrigin && !apiOrigin.startsWith('/')) connect.push(apiOrigin);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://*.mapbox.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
      genReqId: () => randomUUID(),
    })
  );

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Request-Id', request.id);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    reply.header('Content-Security-Policy', contentSecurityPolicy());
    return payload;
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const origins = corsOrigins();
  app.enableCors({
    origin: origins,
    credentials: origins !== '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  });

  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`🚗 Roadtrip4me API running on http://localhost:${port}/api/v1`);
}

bootstrap();
