# AGENTS.md

## Important Notes

- **Redis is intentionally not used.** Do not add `redis`, `REDIS_URL`, `ioredis`, `CacheModule`, or any Redis/Valkey dependencies to the codebase. The API does not use caching — all state is managed through PostgreSQL.
