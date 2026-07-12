import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { SCHEMA_SQL } from './schema.js'
import {
  budgets,
  clients,
  preferences,
  projects,
  rates,
  syncOutbox,
  syncState,
  tasks,
  timeEntries,
} from './tables.js'

/**
 * Drift guard (ADR-0046): the Drizzle tables (`tables.ts`, the typed query layer)
 * and the runtime DDL (`SCHEMA_SQL` in `schema.ts`) are two definitions of one
 * schema. This asserts every Drizzle column has a matching column in the table's
 * `CREATE TABLE`, so a rename/typo on one side can never ship a query against a
 * column the DDL never created.
 */
const ALL: readonly SQLiteTable[] = [
  clients,
  projects,
  tasks,
  timeEntries,
  rates,
  budgets,
  preferences,
  syncOutbox,
  syncState,
]

function createBlock(tableName: string): string {
  const match = new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\(([\\s\\S]*?)\\);`).exec(
    SCHEMA_SQL,
  )
  if (!match?.[1]) throw new Error(`no CREATE TABLE for ${tableName} in SCHEMA_SQL`)
  return match[1]
}

describe('Drizzle tables ↔ SCHEMA_SQL', () => {
  it('Tables_EveryDrizzleColumn_ExistsInTheDdl', () => {
    for (const table of ALL) {
      const config = getTableConfig(table)
      const block = createBlock(config.name).replace(/--[^\n]*/g, '') // strip inline comments
      const ddlColumns = block
        .split(',')
        .map(line => line.trim().split(/\s+/)[0])
        .filter((token): token is string => token !== undefined && /^[a-z_]+$/.test(token))
      for (const column of config.columns) {
        expect(ddlColumns, `${config.name}.${column.name}`).toContain(column.name)
      }
    }
  })
})
