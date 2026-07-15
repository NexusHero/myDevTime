import { afterEach, describe, expect, it } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { loadConfig } from '../../config.js'
import { buildApp } from '../../app.js'

/**
 * The public `/api/auth/providers` endpoint tells the login/register screens which
 * sign-in methods are actually configured, so a social button is only enabled once
 * its OAuth client id + secret are set (it mirrors `createAuth`'s `socialProviders`).
 * No DB is needed — it reads config only.
 */
describe('auth providers endpoint', () => {
  let app: NestFastifyApplication | null = null

  afterEach(async () => {
    await app?.close()
    app = null
  })

  async function providers(env: Record<string, string>): Promise<{
    emailPassword: boolean
    social: string[]
  }> {
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent', AUTH_SECRET: 'x'.repeat(32), ...env }),
      db: null,
    })
    const res = await app.inject({ method: 'GET', url: '/api/auth/providers' })
    expect(res.statusCode).toBe(200)
    const body: { emailPassword: boolean; social: string[] } = res.json()
    return body
  }

  it('reportsEmailPassword_AndNoSocial_WhenNoOAuthConfigured', async () => {
    expect(await providers({})).toEqual({ emailPassword: true, social: [] })
  })

  it('listsOnlyProvidersWithBothIdAndSecret', async () => {
    const body = await providers({
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
      GITHUB_CLIENT_ID: 'hid',
      GITHUB_CLIENT_SECRET: 'hsecret',
      // Apple has only an id → must NOT be listed.
      APPLE_CLIENT_ID: 'aid',
    })
    expect(body.emailPassword).toBe(true)
    expect([...body.social].sort()).toEqual(['github', 'google'])
  })
})
