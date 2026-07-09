import type { Config } from '../config.js'
import type { Db, DbHandle } from '../db/client.js'

/**
 * Injection tokens for the values that used to be threaded through the factory
 * modules' `deps` object (ADR-0024) and are now provided once by `CoreModule`
 * and injected where needed (ADR-0025). Symbols keep them collision-free and
 * out of the type-metadata path (so no interface-token ambiguity).
 */
export const CONFIG = Symbol('CONFIG')
export const DB_HANDLE = Symbol('DB_HANDLE')
export const DB = Symbol('DB')

/** Typed shapes behind each token, for `@Inject(...)` sites. */
export type ConfigToken = Config
export type DbHandleToken = DbHandle | null
export type DbToken = Db | null
