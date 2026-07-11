/**
 * The connector registry (M3, ADR-0032/0033): the dev-relevant integrations and,
 * per provider, the capabilities the product uses and the *least* OAuth scopes each
 * capability needs (ADR-0033: read-only by default; a write scope is requested only
 * when the matching outbound capability is turned on). Pure data + lookups — no
 * secrets, no network. The concrete client-id/secret and whether a provider is
 * actually configured live in the environment, never here.
 */
export type ConnectorId = 'github' | 'gitlab' | 'jira' | 'linear' | 'slack' | 'google-calendar'

/** What a connector can do; consent is stored per capability (ADR-0033). */
export type Capability = 'inbound' | 'outbound' | 'capture'

export interface CapabilitySpec {
  readonly capability: Capability
  /** Human label for the consent UI. */
  readonly label: string
  /** Least-privilege OAuth scopes this capability needs. */
  readonly scopes: readonly string[]
}

export interface ConnectorSpec {
  readonly id: ConnectorId
  readonly label: string
  readonly category: 'git' | 'issues' | 'chat' | 'calendar'
  /** OAuth 2.0 auth type — GitHub can also be a GitHub App (an open decision). */
  readonly auth: 'oauth2'
  readonly capabilities: readonly CapabilitySpec[]
}

const READ = 'inbound' as const
const WRITE = 'outbound' as const
const CAPTURE = 'capture' as const

export const CONNECTORS: readonly ConnectorSpec[] = [
  {
    id: 'github',
    label: 'GitHub',
    category: 'git',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Issues & Commits lesen', scopes: ['repo:read'] },
      { capability: WRITE, label: 'Issues erstellen', scopes: ['repo:write'] },
    ],
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    category: 'git',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Issues & Commits lesen', scopes: ['read_api'] },
      { capability: WRITE, label: 'Issues erstellen', scopes: ['api'] },
    ],
  },
  {
    id: 'jira',
    label: 'Jira',
    category: 'issues',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Tickets lesen', scopes: ['read:jira-work'] },
      { capability: WRITE, label: 'Tickets & Worklogs schreiben', scopes: ['write:jira-work'] },
    ],
  },
  {
    id: 'linear',
    label: 'Linear',
    category: 'issues',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Issues lesen', scopes: ['read'] },
      { capability: WRITE, label: 'Issues schreiben', scopes: ['write'] },
    ],
  },
  {
    id: 'slack',
    label: 'Slack',
    category: 'chat',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Kontext lesen', scopes: ['channels:history'] },
      { capability: WRITE, label: 'Zusammenfassungen posten', scopes: ['chat:write'] },
    ],
  },
  {
    id: 'google-calendar',
    label: 'Google Kalender',
    category: 'calendar',
    auth: 'oauth2',
    capabilities: [
      {
        capability: READ,
        label: 'Termine lesen',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      },
      { capability: CAPTURE, label: 'Termine als Capture-Kandidaten', scopes: [] },
    ],
  },
]

const BY_ID = new Map<string, ConnectorSpec>(CONNECTORS.map(c => [c.id, c]))

export function connectorById(id: string): ConnectorSpec | undefined {
  return BY_ID.get(id)
}

export function isConnectorId(id: string): id is ConnectorId {
  return BY_ID.has(id)
}

/**
 * The minimal scope set to request for a connector given the capabilities the user
 * has consented to — least-privilege by construction: no consent → no scopes; a
 * write scope only appears when the outbound capability is granted (ADR-0033).
 */
export function scopesForGrantedCapabilities(
  id: ConnectorId,
  granted: readonly Capability[],
): string[] {
  const spec = BY_ID.get(id)
  if (spec === undefined) return []
  const set = new Set<string>()
  for (const cap of spec.capabilities) {
    if (granted.includes(cap.capability)) for (const s of cap.scopes) set.add(s)
  }
  return [...set].sort()
}
