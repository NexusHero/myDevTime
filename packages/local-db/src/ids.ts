/**
 * Id + timestamp helpers. Ids are client-generated UUIDs (ADR-0040: TEXT primary
 * keys, no server round-trip), which is also what the ADR-0019 sync engine needs
 * (a stable id that survives offline creation). Timestamps are one consistent
 * ISO-8601 format everywhere — never SQLite's `datetime('now')`, whose
 * space-separated form breaks lexicographic range filters when mixed with ISO.
 */

/** A fresh client-generated UUID. */
export function newId(): string {
  return globalThis.crypto.randomUUID()
}

/** The current instant as an ISO-8601 string (the one timestamp format we store). */
export function nowIso(): string {
  return new Date().toISOString()
}
