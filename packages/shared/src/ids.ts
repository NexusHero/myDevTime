/**
 * Branded id types — workspace isolation is enforced by construction
 * (SKILL §"Workspace isolation"; REQ-001). A raw `string` can never be
 * passed where a `WorkspaceId` is required without going through {@link asId},
 * so a repository API that takes a `WorkspaceId` cannot be called with an
 * arbitrary string by accident.
 */

declare const brand: unique symbol

export type Brand<T, B extends string> = T & { readonly [brand]: B }

export type WorkspaceId = Brand<string, 'WorkspaceId'>
export type ProjectId = Brand<string, 'ProjectId'>
export type TaskId = Brand<string, 'TaskId'>
export type TimeEntryId = Brand<string, 'TimeEntryId'>

/**
 * Construct a branded id from a validated string. Throws on empty/blank input
 * so an id is never silently the empty string.
 */
export function asId<B extends string>(value: string): Brand<string, B> {
  if (value.trim().length === 0) {
    throw new Error('id must be a non-empty string')
  }
  return value as Brand<string, B>
}
