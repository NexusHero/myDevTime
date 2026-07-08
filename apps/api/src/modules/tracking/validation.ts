/**
 * Pure catalog validation (REQ-001): naming and archiving invariants that need
 * no database. DB-level workspace isolation is enforced separately by the
 * workspace-scoped queries; these are the rules that don't touch I/O, so they
 * are tested exhaustively on their own.
 */

export const MAX_NAME_LENGTH = 200

/** Trim surrounding whitespace; the canonical stored form of a name. */
export function normalizeName(raw: string): string {
  return raw.trim()
}

/** A name is 1–200 characters after trimming. */
export function isValidName(raw: string): boolean {
  const n = raw.trim()
  return n.length >= 1 && n.length <= MAX_NAME_LENGTH
}

/**
 * Archiving semantics: an archived parent keeps its history but blocks new
 * children (and new entries). Returns true when a child may be created under it.
 */
export function canCreateChild(parent: { readonly archived: boolean }): boolean {
  return !parent.archived
}
