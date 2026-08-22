import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (!process.env.DATABASE_URL) {
  config({ path: path.join(import.meta.dirname, 'apps/api/.env') });
}

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
    seed: 'bun apps/api/prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL || '',
  },
});
