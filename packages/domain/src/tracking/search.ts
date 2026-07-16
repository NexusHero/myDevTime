/**
 * Deterministic note search (REQ-036). The canonical match semantics for an entry
 * note against a user query — case-insensitive, whitespace-trimmed substring — kept
 * pure here so the client (instant local filtering of loaded entries) and the server
 * (`ILIKE '%q%'` over the full dataset) agree on exactly what "matches" means. A
 * blank query matches everything (it is not a filter); an entry with no note never
 * matches a non-blank query.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/** Whether a note contains the query as a case-insensitive substring. */
export function matchesNoteQuery(note: string | undefined | null, query: string): boolean {
  const q = normalizeQuery(query)
  if (q === '') return true
  if (note === undefined || note === null) return false
  return note.toLowerCase().includes(q)
}

/** Filter entries to those whose note matches the query (order preserved). */
export function searchEntriesByNote<T extends { note?: string | null | undefined }>(
  entries: readonly T[],
  query: string,
): T[] {
  const q = normalizeQuery(query)
  if (q === '') return [...entries]
  return entries.filter(e => matchesNoteQuery(e.note, q))
}
