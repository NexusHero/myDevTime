import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` reads this to emit SQL migrations from src/db/schema.ts.
// DATABASE_URL is only needed for `drizzle-kit push`/introspection, not generate.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/mydevtime',
  },
})
