import { z } from 'zod'

/**
 * 12-factor configuration (SKILL §2.3): everything volatile — ports, log level,
 * connection strings — comes from the environment, validated once at boot. No
 * endpoints, keys, or model names as literals anywhere else in the codebase.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    // Optional so the app can boot for unit tests / OpenAPI emit without a DB;
    // readiness checks and integration tests require it.
    DATABASE_URL: z.url().optional(),
    // Redis backing for the global rate limiter (ADR-0050). Unset → the throttler
    // falls back to per-instance in-memory counters (fine for tests/single-node).
    REDIS_URL: z.url().optional(),
    // Whether to trust `X-Forwarded-*` headers for the client IP the rate limiter
    // keys on (ADR-0050). Only enable behind a trusted proxy (nginx/LB) — trusting
    // it on a directly-reachable API lets clients spoof their IP. Default off.
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),

    // Auth (ADR-0007/0017). Secret + base URL are required in production; in
    // dev/test the auth module falls back to a fixed dev value so the app boots.
    AUTH_SECRET: z.string().min(32).optional(),
    AUTH_BASE_URL: z.url().optional(),
    // Comma-separated list of origins allowed to send credentialed auth requests.
    TRUSTED_ORIGINS: z.string().optional(),
    // Whether a fresh email/password account must verify its email before it can
    // sign in. On by default and **forced on in production** (refine below); only a
    // non-prod E2E/dev stack may set 'false', so automated acceptance tests can
    // sign up and sign in without a mailbox (ADR-0053).
    AUTH_REQUIRE_EMAIL_VERIFICATION: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),
    // Whether Better-Auth's abuse-protection rate limiter is active (REQ-002 /
    // SKILL §4). On by default in every environment and **forced on in production**
    // (refine below); only a non-prod E2E stack may set 'false', so acceptance
    // tests can sign up / sign in in bulk from one IP without tripping the limiter
    // (ADR-0053). Never disable it to work around a real limit in a live system.
    AUTH_RATE_LIMIT_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),

    // Transactional email (verification, password reset, account-deletion). When
    // SMTP_URL is set the SMTP transport is used; otherwise emails are logged
    // (dev/CI). EMAIL_FROM is the sender address.
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default('myDevTime <no-reply@mydevtime.app>'),

    // Social providers (Google + Apple + GitHub). Each provider is enabled only
    // when both id and secret are present, so the app runs with any subset.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // Stripe web payment rail (ADR-0006, #22). All optional so the app boots
    // without billing configured; the checkout/portal routes and the webhook
    // endpoint each require the relevant values (checked where used).
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // The Stripe Price id for the Pro subscription (test/live), used by Checkout.
    STRIPE_PRICE_PRO: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === 'production' && !cfg.AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'AUTH_SECRET (>=32 chars) is required in production',
      })
    }
    // The auth origin (cookies/redirects) must come from a trusted config value,
    // not the client Host header — so require it in production.
    if (cfg.NODE_ENV === 'production' && !cfg.AUTH_BASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_BASE_URL'],
        message: 'AUTH_BASE_URL is required in production (trusted auth origin)',
      })
    }
    // Email verification can never be disabled in production — the E2E escape
    // hatch is a non-prod concession only (ADR-0053).
    if (cfg.NODE_ENV === 'production' && !cfg.AUTH_REQUIRE_EMAIL_VERIFICATION) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_REQUIRE_EMAIL_VERIFICATION'],
        message: 'AUTH_REQUIRE_EMAIL_VERIFICATION cannot be false in production',
      })
    }
    // The rate limiter is an abuse-protection control — never disable it in
    // production; the E2E escape hatch is a non-prod concession only (ADR-0053).
    if (cfg.NODE_ENV === 'production' && !cfg.AUTH_RATE_LIMIT_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_RATE_LIMIT_ENABLED'],
        message: 'AUTH_RATE_LIMIT_ENABLED cannot be false in production',
      })
    }
  })

export type Config = Readonly<z.infer<typeof envSchema>>

/**
 * Parse and validate configuration from a raw environment. Throws a readable
 * error listing every invalid/missing variable rather than failing later at use.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(i => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return Object.freeze(parsed.data)
}
