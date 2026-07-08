import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from '../../db/client.js'
import type { Config } from '../../config.js'
import { user, session, account, verification } from '../../db/auth-schema.js'
import type { EmailPort } from './email-port.js'

export interface CreateAuthDeps {
  readonly db: Db
  readonly config: Config
  readonly email: EmailPort
}

// Dev/test-only fallback so the app boots without an AUTH_SECRET; production
// requires a real one (enforced in config.ts).
const DEV_ONLY_SECRET = 'dev-insecure-secret-not-for-production-use-only'

/**
 * The single place Better-Auth is configured (ADR-0017). Every vendor type stays
 * inside this module; upstream code sees only `AuthenticatedUser` (contract.ts),
 * enforced by the confinement test. Session model: opaque server-side DB
 * sessions (amends ADR-0007) — revocation is deleting the row.
 */
export function createAuth({ db, config, email }: CreateAuthDeps) {
  const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {}
  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
    }
  }
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: config.GITHUB_CLIENT_ID,
      clientSecret: config.GITHUB_CLIENT_SECRET,
    }
  }
  if (config.APPLE_CLIENT_ID && config.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: config.APPLE_CLIENT_ID,
      clientSecret: config.APPLE_CLIENT_SECRET,
    }
  }

  const trustedOrigins = (config.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0)

  return betterAuth({
    secret: config.AUTH_SECRET ?? DEV_ONLY_SECRET,
    ...(config.AUTH_BASE_URL ? { baseURL: config.AUTH_BASE_URL } : {}),
    basePath: '/api/auth',
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user: u, url }) =>
        email.send({ to: u.email, subject: 'Reset your myDevTime password', text: url }),
    },
    emailVerification: {
      sendVerificationEmail: ({ user: u, url }) =>
        email.send({ to: u.email, subject: 'Verify your myDevTime email', text: url }),
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ['google', 'apple', 'github'] },
    },
    // Account deletion — DSGVO / store-policy groundwork (REQ-002). Deletion is
    // confirmed by an emailed token; full domain-data erasure lands with the M5
    // privacy issue.
    user: {
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: ({ user: u, url }) =>
          email.send({
            to: u.email,
            subject: 'Confirm your myDevTime account deletion',
            text: url,
          }),
      },
    },
    // Abuse protection (REQ-002 / SKILL §4): on in every environment, with
    // stricter windows on the credential and reset endpoints. In-memory store is
    // fine for the single-process monolith; database storage is a scaling concern.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/forget-password': { window: 60, max: 3 },
      },
    },
    ...(Object.keys(socialProviders).length > 0 ? { socialProviders } : {}),
  })
}

/** The concrete Better-Auth instance type, inferred — confined to this module. */
export type Auth = ReturnType<typeof createAuth>
