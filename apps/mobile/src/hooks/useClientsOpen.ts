import { apiBaseUrl } from '../config.js'
import { fetchClientsOpen, type ClientsOpen } from '../api/invoicing.js'
import { useAsync, type AsyncResource } from './useAsync.js'

const EMPTY: ClientsOpen = { clients: [], currencyCode: 'EUR' }

export interface ClientsOpenResource extends AsyncResource<ClientsOpen> {
  /** Open (un-invoiced) billable amount + hours by client id, for quick lookup. */
  readonly byClient: ReadonlyMap<string, { openMs: number; openMinor: number }>
  readonly live: boolean
}

/**
 * Open (un-invoiced) billable hours + money per client (design v6, ADR-0051) —
 * the "1.443€ offen"-style figure the Projects screen shows at the client level.
 * Live from `GET /api/billing/clients/open` when an API is configured, else an
 * empty result (the demo/test path fabricates no money — ADR-0005). The numbers
 * are the deterministic core's; the client only reads them.
 */
export function useClientsOpen(): ClientsOpenResource {
  const base = apiBaseUrl
  const resource = useAsync<ClientsOpen>(
    () => (base !== null ? fetchClientsOpen(base) : Promise.resolve(EMPTY)),
    `clients-open:${base ?? 'demo'}`,
  )
  const data = resource.data ?? EMPTY
  const byClient = new Map(
    data.clients.map(c => [c.clientId, { openMs: c.openMs, openMinor: c.openMinor }]),
  )
  return { ...resource, byClient, live: base !== null }
}
