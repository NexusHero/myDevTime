# ADR 0050: Redis-backed global rate limiting

## Status

Accepted (owner decision) — new cross-cutting protection on the NestJS API
([ADR-0025](0025-adopt-nestjs-on-fastify.md)); introduces Redis as the first
shared infra dependency. Bound by nothing in the deterministic core (ADR-0005) —
this is transport-layer protection only.

## Context

The API had no protection against brute-force or high-volume automated traffic
(credential stuffing on auth, scraping of public routes). `@nestjs/throttler`
provides rate limiting, but its default in-memory store resets on restart and is
**not shared across instances** — useless the moment the API scales horizontally
or a container recycles.

## Decision

1. **`@nestjs/throttler` bound globally** via `APP_GUARD` (`ThrottlerGuard`), so
   every route is limited by default — **100 requests / 60 s** per client.
2. **Redis storage when available.** `@nest-lab/throttler-storage-redis` (the
   maintained package with NestJS 11 support — not the deprecated
   `nestjs-throttler-storage-redis`) is used when `REDIS_URL` is set, so counters
   are shared across instances; without it the throttler falls back to
   per-instance in-memory counters (fine for tests / single node). The `storage`
   key is omitted entirely when there is no Redis, so no vendor object is
   constructed.
3. **Exemptions.** Health probes (`@SkipThrottle()` on `HealthController`) and the
   Stripe webhook (`@SkipThrottle()` — authenticated by signature, retried from a
   small IP pool) are not throttled, so orchestration probes and payment events are
   never dropped.
4. **Client IP is trusted only behind a proxy.** `trustProxy` is env-gated
   (`TRUST_PROXY`, default **off**); it is enabled in the Docker Compose API
   service because that sits behind the web container's nginx. On a
   directly-reachable API, trusting `X-Forwarded-For` would let clients spoof their
   IP and bypass (or weaponize) the limit.

## Consequences

- **Pros:** brute-force / spam protection out of the box; limits synchronized
  across instances when scaled; Redis is now available for future caching, queues
  (BullMQ), or pub/sub.
- **Cons:** a new infra dependency to run (and pay for in prod); local
  `docker compose` uses a little more memory for the Redis container.
- **Known limitation (follow-up):** if Redis is unreachable the throttler storage
  errors rather than failing open; a fail-open wrapper (serve the request, log the
  degradation) is deferred. Documented here rather than silently accepted.
