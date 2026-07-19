import { z } from 'zod'
import { deleteJson, getJson, postJson } from './http.js'

/**
 * The partner-light Free/Busy sharing client (REQ-064, design v17 §F6). Thin, typed wrappers over
 * the `sharing` API: the owner mints an opaque one-link share, lists their active links, and revokes
 * them. A link is deliberately narrow — it grants ONLY the deterministic Free/Busy projection
 * (busy spans + free gaps, ADR-0005); it never exposes a title, project or note. There is a single
 * scope by construction, so there is no scope to choose — the only knob is an optional label. Every
 * field the API omits is defaulted here so the UI never sees `undefined`.
 *
 * NOTE on the contract: the backend's `POST /api/sharing` accepts only `{ label? }` — there is no
 * scope or expiry field (partner-light == "one link, free to view"). The public view lives at
 * `GET /api/sharing/:token/freebusy`, a windowed JSON endpoint (no dedicated public HTML page), so
 * `shareLinkUrl` points there. The list view (`ShareView`) carries no `revokedAt`/expiry: the server
 * only ever returns active links.
 */

/** The one scope a partner-light link grants — busy-time visibility, nothing more. */
export type ShareScope = 'free-busy'
export const SHARE_SCOPE: ShareScope = 'free-busy'

/** One owner-side share row. `createdAt` arrives as an ISO instant over the wire. */
export const shareSchema = z.object({
  id: z.string(),
  token: z.string(),
  label: z.string().nullable().catch(null).default(null),
  createdAt: z.string().catch(() => new Date().toISOString()),
})
export type Share = z.infer<typeof shareSchema>

/** What create accepts — an optional human label (the token is server-owned). */
export interface CreateShareInput {
  readonly label?: string | null
}

export function parseShare(value: unknown): Share {
  return shareSchema.parse(value)
}

/** List the caller's active (non-revoked) Free/Busy links, newest first (server-ordered). */
export async function listShares(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Share[]> {
  const res = await getJson(baseUrl, '/api/sharing', fetchImpl)
  return z.array(shareSchema).parse(res)
}

/** Mint a new partner-light Free/Busy link; returns the stored link (incl. its token). */
export async function createShare(
  baseUrl: string,
  input: CreateShareInput = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Share> {
  const label = input.label?.trim()
  const body: Record<string, unknown> = label !== undefined && label !== '' ? { label } : {}
  return parseShare(await postJson(baseUrl, '/api/sharing', body, fetchImpl))
}

/** Revoke a link — anyone holding it immediately loses access. Idempotent server-side. */
export async function revokeShare(
  baseUrl: string,
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await deleteJson(baseUrl, `/api/sharing/${id}`, fetchImpl)
}

/** The public URL a link resolves to — the windowed Free/Busy view the token grants. */
export function shareLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/sharing/${token}/freebusy`
}
