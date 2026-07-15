import { describe, expect, it } from 'vitest'
import { disconnectConnector, getConnectors, parseConnector, setConsent } from './connectors.js'

/**
 * The connectors client (M3): parse the honest per-connector state and hit the
 * consent/disconnect routes. The badge state (connected/configured) comes straight
 * from the server — the client never fabricates a "Verbunden".
 */
const CONNECTOR = {
  id: 'github',
  label: 'GitHub',
  category: 'git',
  configured: true,
  connected: false,
  capabilities: [{ capability: 'inbound', label: 'Read issues', granted: true }],
}

interface Seen {
  url: string
  method: string | undefined
  body: unknown
}

const jsonFetch = (body: unknown, seen: Seen[]): typeof fetch =>
  ((url: string, init?: RequestInit) => {
    seen.push({
      url,
      method: init?.method,
      body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
    })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

describe('parseConnector', () => {
  it('ReadsTheHonestState', () => {
    const c = parseConnector(CONNECTOR)
    expect(c.configured).toBe(true)
    expect(c.connected).toBe(false)
    expect(c.capabilities[0]?.granted).toBe(true)
  })
})

describe('requests', () => {
  it('GetsTheConnectorList', async () => {
    const seen: Seen[] = []
    const list = await getConnectors('http://api', jsonFetch([CONNECTOR], seen))
    expect(list[0]?.id).toBe('github')
    expect(seen[0]?.url).toContain('/api/connectors')
  })

  it('PutsConsentForACapability', async () => {
    const seen: Seen[] = []
    await setConsent('http://api', 'github', 'outbound', true, jsonFetch([CONNECTOR], seen))
    expect(seen[0]?.url).toContain('/api/connectors/github/consent')
    expect(seen[0]?.method).toBe('PUT')
    expect(seen[0]?.body).toEqual({ capability: 'outbound', granted: true })
  })

  it('DisconnectsAConnector', async () => {
    const seen: Seen[] = []
    await disconnectConnector('http://api', 'github', jsonFetch([], seen))
    expect(seen[0]?.url).toContain('/api/connectors/github')
    expect(seen[0]?.method).toBe('DELETE')
  })
})
