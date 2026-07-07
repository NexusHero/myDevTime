import { writeFileSync } from 'node:fs'
import { loadConfig } from './config.js'
import { buildApp } from './app.js'

/**
 * Emit the OpenAPI spec generated from the route schemas to a file, so CI can
 * publish it as an artifact and it can never silently drift from the routes
 * (issue #3). Runs without a database — the spec is derived from schemas only.
 */
async function main(): Promise<void> {
  const config = loadConfig({ ...process.env, NODE_ENV: 'test' })
  const app = await buildApp({ config, db: null })
  const spec = app.swagger()
  const out = process.argv[2] ?? 'openapi.json'
  writeFileSync(out, JSON.stringify(spec, null, 2))
  await app.close()
  // eslint-disable-next-line no-console -- CLI script, intentional operator feedback
  console.log(`✓ OpenAPI written to ${out}`)
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- CLI script, surface the failure
  console.error(err)
  process.exit(1)
})
