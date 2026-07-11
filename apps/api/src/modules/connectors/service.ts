import type { Db } from '../../db/client.js'
import { grantedCapabilities } from './consent.js'
import { hasToken } from './vault.js'
import {
  CONNECTORS,
  connectorById,
  scopesForGrantedCapabilities,
  type Capability,
  type ConnectorId,
  type ConnectorSpec,
} from './registry.js'

/**
 * Connector status + OAuth-URL assembly (M3, ADR-0032/0033). De-fakes the
 * "Integrationen" screen: instead of a local on/off toggle it reports the real
 * state — is the provider configured (client-id in the env/KMS), is the user
 * connected (a sealed token exists), and which capabilities they have consented to.
 * The client-id/secret live only in the environment; nothing here fabricates a
 * connection, so an unconfigured provider is shown honestly as "geplant".
 */
export interface CapabilityStatus {
  readonly capability: Capability
  readonly label: string
  readonly granted: boolean
}

export interface ConnectorStatus {
  readonly id: ConnectorId
  readonly label: string
  readonly category: ConnectorSpec['category']
  /** The provider has an OAuth app configured (client id present) in this deployment. */
  readonly configured: boolean
  /** The user has a stored (sealed) token — a real connection exists. */
  readonly connected: boolean
  readonly capabilities: readonly CapabilityStatus[]
}

/** OAuth authorize endpoints per provider (the token exchange lives in the callback). */
const AUTHORIZE_ENDPOINT: Record<ConnectorId, string> = {
  github: 'https://github.com/login/oauth/authorize',
  gitlab: 'https://gitlab.com/oauth/authorize',
  jira: 'https://auth.atlassian.com/authorize',
  linear: 'https://linear.app/oauth/authorize',
  slack: 'https://slack.com/oauth/v2/authorize',
  'google-calendar': 'https://accounts.google.com/o/oauth2/v2/auth',
}

/** The env var holding a provider's OAuth client id (secret stays server-only). */
export function clientIdEnvKey(id: ConnectorId): string {
  return `CONNECTOR_${id.toUpperCase().replace(/-/g, '_')}_CLIENT_ID`
}

/** Whether a provider is configured for OAuth in this deployment (client id present). */
export function isConfigured(id: ConnectorId, env: Record<string, string | undefined>): boolean {
  const v = env[clientIdEnvKey(id)]
  return typeof v === 'string' && v.length > 0
}

/**
 * Build the provider's OAuth authorize URL for the capabilities the user consented
 * to (least privilege — no consent, no scopes; ADR-0033), or null when the provider
 * is not configured. Pure: URL in, URL out, no network.
 */
export function buildAuthorizeUrl(
  id: ConnectorId,
  env: Record<string, string | undefined>,
  opts: { redirectUri: string; state: string; granted: readonly Capability[] },
): string | null {
  if (!isConfigured(id, env)) return null
  const clientId = env[clientIdEnvKey(id)]
  if (clientId === undefined) return null
  const scopes = scopesForGrantedCapabilities(id, opts.granted)
  const url = new URL(AUTHORIZE_ENDPOINT[id])
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', opts.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', opts.state)
  if (scopes.length > 0) url.searchParams.set('scope', scopes.join(' '))
  return url.toString()
}

/** The honest status for every connector, for a user in a workspace. */
export async function connectorStatuses(
  db: Db,
  key: { workspaceId: string; userId: string },
  env: Record<string, string | undefined>,
): Promise<ConnectorStatus[]> {
  const out: ConnectorStatus[] = []
  for (const spec of CONNECTORS) {
    const scoped = { ...key, connector: spec.id }
    const [connected, granted] = await Promise.all([
      hasToken(db, scoped),
      grantedCapabilities(db, scoped),
    ])
    out.push({
      id: spec.id,
      label: spec.label,
      category: spec.category,
      configured: isConfigured(spec.id, env),
      connected,
      capabilities: spec.capabilities.map(c => ({
        capability: c.capability,
        label: c.label,
        granted: granted.includes(c.capability),
      })),
    })
  }
  return out
}

/** Narrow a raw id to a known connector spec (or throw a NotFound-worthy null). */
export function requireConnector(id: string): ConnectorSpec {
  const spec = connectorById(id)
  if (spec === undefined) throw new Error(`unknown connector: ${id}`)
  return spec
}
