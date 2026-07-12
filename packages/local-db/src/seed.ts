import type { LocalDb } from './client.js'

export async function seedLocalDb(db: LocalDb): Promise<void> {
  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) as count FROM projects')
  const count = rows[0]?.count ?? 0
  if (count > 0) return

  // 1. Seed Projects and Tasks
  const CLIENTS = [
    {
      id: 'nexushero',
      name: 'NexusHero',
      projects: [
        {
          id: 'finanzo',
          name: 'Finanzo',
          tasks: [
            { id: 'f1', name: 'Ledger domain core' },
            { id: 'f2', name: 'Reconciliation UI' },
            { id: 'f3', name: 'CSV import' },
          ],
        },
        {
          id: 'sync-engine',
          name: 'Sync engine',
          tasks: [
            { id: 's1', name: 'CRDT resolve' },
            { id: 's2', name: 'Convergence sim' },
          ],
        },
      ],
    },
    {
      id: 'nordwind',
      name: 'Nordwind GmbH',
      projects: [
        {
          id: 'nordwind',
          name: 'Website relaunch',
          tasks: [
            { id: 'n1', name: 'Design system' },
            { id: 'n2', name: 'CMS migration' },
          ],
        },
      ],
    },
  ]

  for (const client of CLIENTS) {
    for (const project of client.projects) {
      await db.runAsync(
        'INSERT INTO projects (id, name, client_name, billable_default, archived) VALUES (?, ?, ?, ?, 0)',
        [project.id, project.name, client.name, 1],
      )
      for (const task of project.tasks) {
        await db.runAsync(
          'INSERT INTO tasks (id, project_id, name, billable_default, archived) VALUES (?, ?, ?, ?, 0)',
          [task.id, project.id, task.name, 1],
        )
      }
    }
  }

  // 2. Seed Preferences
  const defaultPrefs = {
    theme: 'system',
    clock_format: '24h',
    calendar_start_day: 1, // monday
    notify_breaks: true,
  }
  for (const [key, value] of Object.entries(defaultPrefs)) {
    await db.runAsync('INSERT INTO preferences (key, value) VALUES (?, ?)', [key, String(value)])
  }

  // 3. Seed Credit Entries
  const at = (d: number): string => `2026-07-${String(d).padStart(2, '0')}T09:00:00.000Z`
  const credits = [
    {
      id: 'l1',
      kind: 'grant',
      amount: 500,
      category: 'monthly-grant',
      reason: 'Monthly Pro grant',
      at: at(1),
    },
    {
      id: 'l2',
      kind: 'debit',
      amount: -8,
      category: 'meeting-insights',
      reason: 'Finanzo review',
      at: at(7),
    },
    { id: 'l3', kind: 'debit', amount: -4, category: 'nl-entry', reason: null, at: at(8) },
    {
      id: 'l4',
      kind: 'debit',
      amount: -1,
      category: 'assistant',
      reason: 'Budget question',
      at: at(8),
    },
    {
      id: 'l5',
      kind: 'debit',
      amount: -2,
      category: 'co-planner',
      reason: 'Day proposal',
      at: at(9),
    },
  ]
  for (const entry of credits) {
    await db.runAsync(
      'INSERT INTO credit_entries (id, kind, amount, category, reason, at) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, entry.kind, entry.amount, entry.category, entry.reason, entry.at],
    )
  }
}
