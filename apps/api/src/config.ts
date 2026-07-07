import { z } from 'zod'

/**
 * 12-factor configuration (SKILL §2.3): everything volatile — ports, log level,
 * connection strings — comes from the environment, validated once at boot. No
 * endpoints, keys, or model names as literals anywhere else in the codebase.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Optional so the app can boot for unit tests / OpenAPI emit without a DB;
  // readiness checks and integration tests require it.
  DATABASE_URL: z.string().url().optional(),
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
