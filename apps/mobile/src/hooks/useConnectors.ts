import { useCallback } from 'react'
import { Platform } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiBaseUrl } from '../config.js'
import {
  authorizeConnector,
  disconnectConnector,
  getConnectors,
  previewCalendarImport,
  setConsent,
  type CalendarImportPlan,
  type CalendarPreviewRange,
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
  /**
   * Start the OAuth flow: fetch the provider authorize URL and, on web, navigate to
   * it (`window.location.assign`); on native the URL is returned for the caller to
   * open (`Linking.openURL`). Rejects with the backend's honest 409 `ApiError` when
   * the provider isn't configured / no consent is granted — never a fake connect.
   * Resolves `null` offline (no backend to authorize against).
   */
  readonly connect: (id: string) => Promise<string | null>
  /**
   * Preview the Google Calendar import: the deterministic `planImport` **proposals**
   * (ghost blocks, writes nothing — ADR-0005). Rejects with the honest 409 `ApiError`
   * when `inbound` consent is missing or the calendar isn't connected (REQ-025).
   */
  readonly previewCalendar: (range?: CalendarPreviewRange) => Promise<CalendarImportPlan>
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

  const doConnect = useCallback(
    async (id: string): Promise<string | null> => {
      if (base === null) return null // offline: OAuth needs the vault backend
      const { url } = await authorizeConnector(base, id)
      // Web hands off to the provider in the same tab; native returns the URL so the
      // caller can open it (Linking) and receive the deep-link callback.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.assign(url)
      }
      return url
    },
    [base],
  )

  const doPreviewCalendar = useCallback(
    (range: CalendarPreviewRange = {}): Promise<CalendarImportPlan> => {
      if (base === null) {
        return Promise.reject(new Error('Calendar preview needs a configured backend'))
      }
      return previewCalendarImport(base, range)
    },
    [base],
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
    connect: doConnect,
    previewCalendar: doPreviewCalendar,
  }
}
