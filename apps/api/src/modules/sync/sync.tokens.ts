import type { PowerSyncKeys } from './powersync-auth.js'

/** DI token for the loaded PowerSync signing key, or `null` when unconfigured. */
export const POWERSYNC_KEYS = Symbol('POWERSYNC_KEYS')
export type PowerSyncKeysToken = PowerSyncKeys | null
