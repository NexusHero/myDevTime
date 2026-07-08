import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../config.js'
import { buildApp } from '../../app.js'

/**
 * The shared guard must reach the root instance (fastify-plugin), so any module
 * can use `preHandler: [app.requireAuth]` and read `request.authUser`. Verifiable
 * without a database — only the decoration/propagation is under test here.
 */
describe('auth guard wiring', () => {
  it('BuildApp_Always_DecoratesRequireAuthAndAuthUserAtRoot', async () => {
    const app = await buildApp({ config: loadConfig({ LOG_LEVEL: 'silent' }), db: null })

    expect(app.hasDecorator('requireAuth')).toBe(true)
    expect(app.hasRequestDecorator('authUser')).toBe(true)

    await app.close()
  })
})
