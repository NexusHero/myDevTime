import { deleteJson, getJson, putJson } from './http.js'
import { z } from 'zod'

/**
 * The connectors client (M3, ADR-0032/0033): the real state of each OAuth
 * integration — is it configured in this deployment, is the user connected (a
 * sealed token exists), and which capabilities they have consented to. Replaces the
 * old fake "Verbunden" toggle: an unconfigured provider is shown honestly as
 * "geplant", never as connected.
 */
export const capabilitySchema = z.enum(['inbound', 'outbound', 'capture'])
export type Capability = z.infer<typeof capabilitySchema>

export const capabilityStatusSchema = z.object({
  capability: capabilitySchema.catch('inbound'),
  label: z.string(),
  granted: z.boolean().default(false),
})
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>

export const connectorStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  configured: z.boolean().default(false),
  connected: z.boolean().default(false),
  capabilities: z.array(capabilityStatusSchema).catch([]).default([]),
})
export type ConnectorStatus = z.infer<typeof connectorStatusSchema>

export function parseConnector(value: unknown): ConnectorStatus {
  return connectorStatusSchema.parse(value)
}

/** List every connector's real state for the caller's workspace. */
export async function getConnectors(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const res = await getJson(baseUrl, '/api/connectors', fetchImpl)
  return z.array(connectorStatusSchema).parse(res)
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
  return z.array(connectorStatusSchema).parse(body)
}

/** Disconnect a connector: deletes sealed tokens + revokes consent server-side. */
export async function disconnectConnector(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectorStatus[]> {
  const res = await deleteJson(baseUrl, `/api/connectors/${id}`, fetchImpl)
  return z.array(connectorStatusSchema).parse(res)
}
