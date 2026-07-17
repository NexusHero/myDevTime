import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm'
import { toFreeBusy, freeGaps, type FreeBusySlot, type Window } from '@mydevtime/domain'
import type { Db } from '../../db/client.js'
import { partnerShares, timeEntries } from '../../db/schema.js'
import { NotFoundError } from '../../errors.js'

/**
 * Partner-light Free/Busy sharing (REQ-064, design v17 §F6). The owner mints an opaque one-link
 * share; an invitee visits it without an account and sees only *when* the owner is busy. The
 * projection is the deterministic `packages/domain/sharing` core (ADR-0005); this service stores
 * links, resolves a token to a workspace, and shapes time-entry rows into the core's input.
 * Because the core's output type carries no title/project/note, private detail cannot leak — the
 * endpoint never even reads those columns.
 */

export type ShareRow = typeof partnerShares.$inferSelect

function first<T>(rows: readonly T[]): T {
  const row = rows[0]
  if (!row) throw new Error('insert returned no row')
  return row
}

/** A fresh, unguessable link secret (URL-safe). */
function newToken(): string {
  return randomBytes(24).toString('base64url')
}

/** What the owner's own list shows — never the busy detail, just the link's identity. */
export interface ShareView {
  readonly id: string
  readonly token: string
  readonly label: string | null
  readonly createdAt: Date
}

function toView(row: ShareRow): ShareView {
  return { id: row.id, token: row.token, label: row.label, createdAt: row.createdAt }
}

/** Create a partner-light share in the caller's workspace. */
export async function createShare(
  db: Db,
  workspaceId: string,
  userId: string,
  label: string | null,
): Promise<ShareView> {
  const rows = await db
    .insert(partnerShares)
    .values({ workspaceId, userId, token: newToken(), label })
    .returning()
  return toView(first(rows))
}

/** List the workspace's active (non-revoked) shares, newest first. */
export async function listShares(db: Db, workspaceId: string): Promise<ShareView[]> {
  const rows = await db
    .select()
    .from(partnerShares)
    .where(and(eq(partnerShares.workspaceId, workspaceId), isNull(partnerShares.revokedAt)))
    .orderBy(partnerShares.createdAt)
  return rows.map(toView).reverse()
}

/** Revoke a share in the caller's workspace (idempotent per link; the link then resolves to nothing). */
export async function revokeShare(
  db: Db,
  workspaceId: string,
  id: string,
  atMs: number,
): Promise<void> {
  const rows = await db
    .update(partnerShares)
    .set({ revokedAt: new Date(atMs) })
    .where(
      and(
        eq(partnerShares.workspaceId, workspaceId),
        eq(partnerShares.id, id),
        isNull(partnerShares.revokedAt),
      ),
    )
    .returning({ id: partnerShares.id })
  if (rows.length === 0) throw new NotFoundError('share not found')
}

/** Resolve a link token to its workspace — only if the link exists and is not revoked. */
export async function resolveShare(db: Db, token: string): Promise<{ workspaceId: string } | null> {
  const rows = await db
    .select({ workspaceId: partnerShares.workspaceId })
    .from(partnerShares)
    .where(and(eq(partnerShares.token, token), isNull(partnerShares.revokedAt)))
    .limit(1)
  return rows[0] ?? null
}

/** The Free/Busy response an invitee receives — busy spans + the free gaps, nothing else. */
export interface FreeBusyResult {
  readonly busy: readonly FreeBusySlot[]
  readonly free: readonly Window[]
}

/**
 * Project entry rows to a window-bounded Free/Busy view. **Pure** and the tested heart of the
 * public endpoint: only `startedAt`/`endedAt` are read — never a title/project/note — and a still
 * running timer (no `endedAt`) is clamped to the window end ("busy now"). Busy spans are clipped
 * to the window so the response never reaches past what was asked for.
 */
export function projectFreeBusy(
  entries: readonly { startedAt: Date; endedAt: Date | null }[],
  window: Window,
): FreeBusyResult {
  const blocks = entries.map(e => ({
    startMs: e.startedAt.getTime(),
    endMs: (e.endedAt ?? new Date(window.endMs)).getTime(),
  }))
  const busy = toFreeBusy(blocks)
    .filter(s => s.endMs > window.startMs && s.startMs < window.endMs)
    .map(s => ({
      startMs: Math.max(s.startMs, window.startMs),
      endMs: Math.min(s.endMs, window.endMs),
      state: 'busy' as const,
    }))
  return { busy, free: freeGaps(blocks, window) }
}

/**
 * Serve Free/Busy for a share token over `[fromMs, toMs)`. Resolves the token to a workspace,
 * reads only that workspace's live entries overlapping the window (never the detail columns), and
 * projects them. Throws `NotFoundError` for an unknown or revoked token — the link is the secret.
 */
export async function freeBusyForShare(
  db: Db,
  token: string,
  fromMs: number,
  toMs: number,
): Promise<FreeBusyResult> {
  const share = await resolveShare(db, token)
  if (!share) throw new NotFoundError('share not found')
  const from = new Date(fromMs)
  const to = new Date(toMs)
  // Only start/end + the overlap/scope filters — no title/project/note is ever selected.
  const rows = await db
    .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.workspaceId, share.workspaceId),
        isNull(timeEntries.deletedAt),
        lt(timeEntries.startedAt, to),
        or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, from)),
      ),
    )
  return projectFreeBusy(rows, { startMs: fromMs, endMs: toMs })
}
