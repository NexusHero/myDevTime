/**
 * The connector registry (M3, ADR-0032/0033): the dev-relevant integrations and,
 * per provider, the capabilities the product uses and the *least* OAuth scopes each
 * capability needs (ADR-0033: read-only by default; a write scope is requested only
 * when the matching outbound capability is turned on). Pure data + lookups — no
 * secrets, no network. The concrete client-id/secret and whether a provider is
 * actually configured live in the environment, never here.
 */
export type ConnectorId =
  | 'github'
  | 'gitlab'
  | 'jira'
  | 'linear'
  | 'slack'
  | 'azure-devops'
  | 'google-calendar'
  | 'microsoft-calendar'
  | 'apple-calendar'

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
  /**
   * How the provider is authorized. `oauth2` connectors go through the OAuth
   * authorize/callback dance; `native` connectors (Apple EventKit) have NO OAuth
   * calendar API — they are read on-device through a native seam, so the OAuth
   * connect flow is never offered for them.
   */
  readonly auth: 'oauth2' | 'native'
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
      { capability: READ, label: 'Read issues & commits', scopes: ['repo:read'] },
      { capability: WRITE, label: 'Create issues', scopes: ['repo:write'] },
    ],
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    category: 'git',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read issues & commits', scopes: ['read_api'] },
      { capability: WRITE, label: 'Create issues', scopes: ['api'] },
    ],
  },
  {
    id: 'jira',
    label: 'Jira',
    category: 'issues',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read tickets', scopes: ['read:jira-work'] },
      { capability: WRITE, label: 'Write tickets & worklogs', scopes: ['write:jira-work'] },
    ],
  },
  {
    id: 'linear',
    label: 'Linear',
    category: 'issues',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read issues', scopes: ['read'] },
      { capability: WRITE, label: 'Write issues', scopes: ['write'] },
    ],
  },
  {
    id: 'slack',
    label: 'Slack',
    category: 'chat',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read context', scopes: ['channels:history'] },
      { capability: WRITE, label: 'Post summaries', scopes: ['chat:write'] },
    ],
  },
  {
    // Azure DevOps (Boards / Work Items) — an issues tracker reached over its REST API (WIQL +
    // work-items batch), OAuth 2.0 (Visual Studio account). Read-only by default: the READ scope
    // `vso.work` grants read access to work items; a write scope (`vso.work_write`) is only added
    // when an outbound capability is turned on (ADR-0033). Import stays proposal-only (ADR-0005).
    id: 'azure-devops',
    label: 'Azure DevOps',
    category: 'issues',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read work items', scopes: ['vso.work'] },
      { capability: WRITE, label: 'Write work items', scopes: ['vso.work_write'] },
    ],
  },
  {
    id: 'google-calendar',
    label: 'Google Calendar',
    category: 'calendar',
    auth: 'oauth2',
    capabilities: [
      {
        capability: READ,
        label: 'Read events',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      },
      { capability: CAPTURE, label: 'Events as capture candidates', scopes: [] },
    ],
  },
  {
    // Microsoft (Outlook / Microsoft 365) Calendar — same calendar port, different adapter.
    // Reached over Microsoft Graph's calendarView; OAuth 2.0 (Azure AD v2). Read-only by
    // default; `offline_access` is requested so a refresh token is issued, and capture stays
    // consent-first (REQ-025) like every other calendar source.
    id: 'microsoft-calendar',
    label: 'Microsoft Calendar',
    category: 'calendar',
    auth: 'oauth2',
    capabilities: [
      { capability: READ, label: 'Read events', scopes: ['Calendars.Read', 'offline_access'] },
      { capability: CAPTURE, label: 'Events as capture candidates', scopes: [] },
    ],
  },
  {
    // Apple Calendar (design v17 §F6) — same calendar port, different adapter. Apple has NO
    // OAuth calendar API: on-device calendars are read through the native EventKit framework,
    // so `auth: 'native'` and the OAuth connect flow is never offered. Read-only by default,
    // and capture stays consent-first (REQ-025) like every other calendar source. Scopes are
    // empty because EventKit access is an on-device permission, not an OAuth scope.
    id: 'apple-calendar',
    label: 'Apple Calendar',
    category: 'calendar',
    auth: 'native',
    capabilities: [
      { capability: READ, label: 'Read events', scopes: [] },
      { capability: CAPTURE, label: 'Events as capture candidates', scopes: [] },
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
