import { useCallback, useEffect, useState } from 'react'
import { apiBaseUrl } from '../config.js'
import {
  disconnectConnector,
  getConnectors,
  setConsent,
  type Capability,
  type ConnectorStatus,
} from '../api/connectors.js'

/**
 * The connectors data source (M3, ADR-0032/0033). With a backend it loads each
 * connector's real state and persists consent/disconnect; offline it shows the
 * known providers honestly as **not configured / not connected** (never a fake
 * "Verbunden"). `live` lets the UI flag that state is real.
 */
const DEMO_CONNECTORS: readonly ConnectorStatus[] = [
  {
    id: 'github',
    label: 'GitHub',
    category: 'git',
    configured: false,
    connected: false,
    capabilities: [],
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    category: 'git',
    configured: false,
    connected: false,
    capabilities: [],
  },
  {
    id: 'jira',
    label: 'Jira',
    category: 'issues',
    configured: false,
    connected: false,
    capabilities: [],
  },
  {
    id: 'linear',
    label: 'Linear',
    category: 'issues',
    configured: false,
    connected: false,
    capabilities: [],
  },
  {
    id: 'slack',
    label: 'Slack',
    category: 'chat',
    configured: false,
    connected: false,
    capabilities: [],
  },
]

export interface ConnectorsResource {
  readonly connectors: readonly ConnectorStatus[]
  readonly live: boolean
  readonly loading: boolean
  readonly error: Error | null
  readonly setConsent: (id: string, capability: Capability, granted: boolean) => void
  readonly disconnect: (id: string) => void
}

export function useConnectors(): ConnectorsResource {
  const base = apiBaseUrl
  const live = base !== null
  const [connectors, setConnectors] = useState<readonly ConnectorStatus[]>(DEMO_CONNECTORS)
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (base === null) return
    let alive = true
    setLoading(true)
    getConnectors(base)
      .then(list => {
        if (alive) {
          setConnectors(list)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause : new Error(String(cause)))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [base])

  const doConsent = useCallback(
    (id: string, capability: Capability, granted: boolean) => {
      if (base === null) return // offline: consent needs the vault backend
      setConsent(base, id, capability, granted)
        .then(setConnectors)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
    },
    [base],
  )

  const doDisconnect = useCallback(
    (id: string) => {
      if (base === null) return
      disconnectConnector(base, id)
        .then(setConnectors)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause : new Error(String(cause)))
        })
    },
    [base],
  )

  return { connectors, live, loading, error, setConsent: doConsent, disconnect: doDisconnect }
}
