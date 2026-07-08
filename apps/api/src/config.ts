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

    // Auth (ADR-0007/0017). Secret + base URL are required in production; in
    // dev/test the auth module falls back to a fixed dev value so the app boots.
    AUTH_SECRET: z.string().min(32).optional(),
    AUTH_BASE_URL: z.url().optional(),
    // Comma-separated list of origins allowed to send credentialed auth requests.
    TRUSTED_ORIGINS: z.string().optional(),

    // Social providers (Google + Apple + GitHub). Each provider is enabled only
    // when both id and secret are present, so the app runs with any subset.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV === 'production' && !cfg.AUTH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_SECRET'],
        message: 'AUTH_SECRET (>=32 chars) is required in production',
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
