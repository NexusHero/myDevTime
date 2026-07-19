import { z } from 'zod'
import { ApiError, getJson, problemToError } from './http.js'

/**
 * The GDPR privacy client (REQ-020, ADR-0015). Thin, typed wrappers over the `privacy` API:
 * data portability (`GET /api/privacy/export` — the complete workspace JSON bundle) and the
 * right to erasure (`DELETE /api/privacy/account`, which the server only honours behind the
 * `confirm: 'DELETE'` literal). Both routes resolve the workspace from the authenticated caller
 * on the server, so a user can only ever export or erase their OWN data — the client never sends
 * a workspace id. The deterministic core owns this path; no AI touches an export or an erasure.
 */

/** The complete export bundle. `data` keeps every workspace-scoped table verbatim (passthrough)
 *  so the downloaded file is a faithful, complete copy of what the server returned. */
export const dataExportSchema = z.object({
  exportedAt: z.string().catch(() => new Date().toISOString()),
  user: z.record(z.string(), z.unknown()).catch({}),
  workspace: z.record(z.string(), z.unknown()).catch({}),
  data: z.record(z.string(), z.unknown()).catch({}),
})
export type DataExport = z.infer<typeof dataExportSchema>

/** The one accepted erasure body — the server validates the literal, so it is fixed here. */
export interface DeleteAccountInput {
  readonly confirm: 'DELETE'
}

export function parseDataExport(value: unknown): DataExport {
  return dataExportSchema.parse(value)
}

/** Fetch the caller's complete workspace export (GDPR Art. 20). Read-only — nothing is mutated. */
export async function requestDataExport(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DataExport> {
  return parseDataExport(await getJson(baseUrl, '/api/privacy/export', fetchImpl))
}

/**
 * Irreversibly erase the caller's account and workspace (GDPR Art. 17). The server requires the
 * exact `{ confirm: 'DELETE' }` body and answers `204 No Content`. The shared `deleteJson` sends
 * no request body, so this issues a credentialed DELETE with the confirmation payload directly,
 * mapping a non-2xx through the same RFC 7807 → `ApiError` seam the rest of the client uses.
 */
export async function deleteAccount(
  baseUrl: string,
  input: DeleteAccountInput,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let res: Response
  try {
    res = await fetchImpl(`${baseUrl}/api/privacy/account`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (cause) {
    throw new ApiError(0, 'Network error', cause instanceof Error ? cause.message : undefined)
  }
  const text = await res.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      // A non-JSON body on an error response still maps to a generic ApiError below.
    }
  }
  if (!res.ok) throw problemToError(res.status, body)
}

/**
 * Web-only: serialize the export bundle and trigger a file download via a Blob + anchor. Returns
 * `false` (and does nothing) when the DOM APIs are absent — e.g. on native — so the caller can
 * fall back honestly instead of pretending a file was saved. Kept here so the screen stays free
 * of DOM plumbing and the seam is easy to stub in tests.
 */
export function triggerJsonDownload(data: unknown, filename: string): boolean {
  if (
    typeof document === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function' ||
    typeof Blob === 'undefined'
  ) {
    return false
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return true
}
