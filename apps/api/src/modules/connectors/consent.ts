import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { connectorGrants } from '../../db/schema.js'
import type { Capability } from './registry.js'

/**
 * Per-capability consent (M3, ADR-0033): nothing a connector does runs without a
 * stored, explicit opt-in for that exact capability (inbound/outbound/capture).
 * Workspace-scoped by construction. This generalises the consent-first rule
 * (REQ-025) from meeting capture to every integration.
 */
export interface GrantKey {
  readonly workspaceId: string
  readonly userId: string
  readonly connector: string
}

/** Set (upsert) a single capability's consent for a connector. */
export async function setGrant(
  db: Db,
  key: GrantKey,
  capability: Capability,
  granted: boolean,
): Promise<void> {
  await db
    .insert(connectorGrants)
    .values({ ...key, capability, granted, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [
        connectorGrants.workspaceId,
        connectorGrants.userId,
        connectorGrants.connector,
        connectorGrants.capability,
      ],
      set: { granted, updatedAt: new Date() },
    })
}

/** The granted capabilities for one connector, for a user. */
export async function grantedCapabilities(db: Db, key: GrantKey): Promise<Capability[]> {
  const rows = await db
    .select({ capability: connectorGrants.capability, granted: connectorGrants.granted })
    .from(connectorGrants)
    .where(
      and(
        eq(connectorGrants.workspaceId, key.workspaceId),
        eq(connectorGrants.userId, key.userId),
        eq(connectorGrants.connector, key.connector),
      ),
    )
  return rows.filter(r => r.granted).map(r => r.capability as Capability)
}

/** Revoke every capability for a connector (part of disconnect/erasure, ADR-0033). */
export async function revokeAllGrants(db: Db, key: GrantKey): Promise<void> {
  await db
    .update(connectorGrants)
    .set({ granted: false, updatedAt: new Date() })
    .where(
      and(
        eq(connectorGrants.workspaceId, key.workspaceId),
        eq(connectorGrants.userId, key.userId),
        eq(connectorGrants.connector, key.connector),
      ),
    )
}
