import { writeFileSync } from 'node:fs'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'
import { createDb } from './db/client.js'

/**
 * Emit the OpenAPI spec generated from the route schemas to a file, so CI can
 * publish it as an artifact and it can never silently drift from the routes
 * (issue #3). A lazy db handle is passed so every DB-backed module registers its
 * routes for introspection; postgres.js connects only on the first query, and
 * emitting never runs one — no database is required.
 */
async function main(): Promise<void> {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
  const handle = createDb(config.DATABASE_URL ?? 'postgres://openapi@localhost:5432/openapi')
  const app = await buildApp({ config, db: handle })
  const spec = app.swagger()
  const out = process.argv[2] ?? 'openapi.json'
  writeFileSync(out, JSON.stringify(spec, null, 2))
  await app.close()
  await handle.close()
  console.log(`✓ OpenAPI written to ${out}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
