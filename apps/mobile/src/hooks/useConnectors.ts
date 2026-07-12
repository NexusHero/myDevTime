import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
 * "Verbunden"). `live` lets the UI flag that state is real. Backed by TanStack
 * Query (ADR-0047): `useQuery` for the load, `useMutation` for consent/disconnect,
 * both writing the returned list straight into the query cache — no hand-rolled
 * `useEffect`/liveness bookkeeping.
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
  const queryClient = useQueryClient()
  const key = ['connectors', base ?? 'demo']

  const query = useQuery<readonly ConnectorStatus[]>({
    queryKey: key,
    queryFn: () => (base === null ? Promise.resolve(DEMO_CONNECTORS) : getConnectors(base)),
  })

  const consentMutation = useMutation({
    mutationFn: (v: { base: string; id: string; capability: Capability; granted: boolean }) =>
      setConsent(v.base, v.id, v.capability, v.granted),
    onSuccess: list => queryClient.setQueryData(key, list),
  })

  const disconnectMutation = useMutation({
    mutationFn: (v: { base: string; id: string }) => disconnectConnector(v.base, v.id),
    onSuccess: list => queryClient.setQueryData(key, list),
  })

  const doConsent = useCallback(
    (id: string, capability: Capability, granted: boolean) => {
      if (base === null) return // offline: consent needs the vault backend
      consentMutation.mutate({ base, id, capability, granted })
    },
    [base, consentMutation],
  )

  const doDisconnect = useCallback(
    (id: string) => {
      if (base === null) return
      disconnectMutation.mutate({ base, id })
    },
    [base, disconnectMutation],
  )

  return {
    connectors: query.data ?? DEMO_CONNECTORS,
    live,
    // Demo data resolves synchronously — only a live backend has a real load.
    loading: live && query.isPending,
    // TanStack Query v5 types errors as `Error`, so coalesce the three sources.
    error: query.error ?? consentMutation.error ?? disconnectMutation.error,
    setConsent: doConsent,
    disconnect: doDisconnect,
  }
}
