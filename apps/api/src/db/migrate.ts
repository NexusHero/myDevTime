import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { loadConfig } from '../config.js'

/**
 * Apply pending SQL migrations from ./migrations. Run via `pnpm db:migrate`
 * (locally and as a deploy step). Migrations are checked-in SQL files generated
 * by `drizzle-kit generate` — never hand-edited after they ship.
 */
async function main(): Promise<void> {
  const { DATABASE_URL } = loadConfig()
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run migrations')
  }
  const sql = postgres(DATABASE_URL, { max: 1 })
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: new URL('./migrations', import.meta.url).pathname,
    })
    console.log('✓ migrations applied')
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
