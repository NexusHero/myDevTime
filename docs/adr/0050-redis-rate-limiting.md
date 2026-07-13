# 50. Redis for Global Rate Limiting

Date: 2026-07-13

## Status

Accepted

## Context

Our NestJS API (`apps/api`) was previously unprotected against brute-force or high-volume automated requests (e.g., DDoS or scraping attempts). While the application is relatively simple now, protecting endpoints—especially authentication and public routes—is a fundamental requirement for a production-grade application.

NestJS provides a built-in rate limiting package (`@nestjs/throttler`). However, the default throttler uses an in-memory storage driver. In a horizontally scaled environment (where multiple API instances run concurrently) or when containers restart, the in-memory rate limiting counters are reset and are not shared between instances, defeating the purpose of the rate limiter.

## Decision

We have decided to introduce **Redis** as a caching and storage layer for the API, starting with its use as a backend for the rate limiter.

1. We added a `redis:7-alpine` container to our `docker-compose.yml` local environment.
2. We installed `@nestjs/throttler`, `nestjs-throttler-storage-redis`, and `ioredis` in `apps/api`.
3. We configured the `ThrottlerModule` in `AppModule` to use the `ThrottlerStorageRedisService` if the `REDIS_URL` environment variable is present (falling back to in-memory for unit tests where Redis is not available).
4. We bound the `ThrottlerGuard` globally using `APP_GUARD`, which means every route is now rate-limited by default.

## Consequences

- **Pros**:
  - The API is protected from spam and brute-force attacks out of the box.
  - The rate limits are synchronized across all API instances when scaling horizontally.
  - We have laid the groundwork for future Redis usage, such as WebSockets Pub/Sub, background jobs (e.g. BullMQ), and heavy query caching.
- **Cons**:
  - Adds a new infrastructural dependency (Redis) which must be managed and paid for in the production environment.
  - Local development using Docker Compose now consumes slightly more memory to run the Redis container.
