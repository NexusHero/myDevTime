import { deleteJson, getJson, putJson } from './http.js'
import { parseArray, record, str } from './parse.js'

/**
 * The connectors client (M3, ADR-0032/0033): the real state of each OAuth
 * integration — is it configured in this deployment, is the user connected (a
 * sealed token exists), and which capabilities they have consented to. Replaces the
 * old fake "Verbunden" toggle: an unconfigured provider is shown honestly as
 * "geplant", never as connected.
 */
export type Capability = 'inbound' | 'outbound' | 'capture'

export interface CapabilityStatus {
  readonly capability: Capability
  readonly label: string
  readonly granted: boolean
}

export interface ConnectorStatus {
  readonly id: string
  readonly label: string
  readonly category: string
  readonly configured: boolean
  readonly connected: boolean
  readonly capabilities: readonly CapabilityStatus[]
}

const CAPS: readonly Capability[] = ['inbound', 'outbound', 'capture']

function parseCapability(value: unknown): CapabilityStatus {
  const o = record(value)
  const cap = str(o, 'capability')
  return {
    capability: (CAPS as readonly string[]).includes(cap) ? (cap as Capability) : 'inbound',
    label: str(o, 'label'),
    granted: o.granted === true,
  }
}

export function parseConnector(value: unknown): ConnectorStatus {
  const o = record(value)
  return {
    id: str(o, 'id'),
    label: str(o, 'label'),
    category: str(o, 'category'),
    configured: o.configured === true,
    connected: o.connected === true,
    capabilities: parseArray(o.capabilities, parseCapability),
  }
}

/** List every connector's real state for the caller's workspace. */
export async function getConnectors(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  return parseArray(await getJson(baseUrl, '/api/connectors', fetchImpl), parseConnector)
}

/** Set a single capability's consent for a connector; returns the fresh full list. */
export async function setConsent(
  baseUrl: string,
  id: string,
  capability: Capability,
  granted: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const body = await putJson(
    baseUrl,
    `/api/connectors/${id}/consent`,
    { capability, granted },
    fetchImpl,
  )
  return parseArray(body, parseConnector)
}

/** Disconnect a connector: deletes sealed tokens + revokes consent server-side. */
export async function disconnectConnector(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  return parseArray(await deleteJson(baseUrl, `/api/connectors/${id}`, fetchImpl), parseConnector)
}
