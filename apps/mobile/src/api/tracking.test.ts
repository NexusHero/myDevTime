import { describe, expect, it } from 'vitest'
import {
  assembleCatalog,
  createProject,
  parseClients,
  parseProject,
  parseProjects,
  parseTasks,
} from './tracking.js'

interface Seen {
  url: string
  method: string
  body: unknown
}
const spyFetch = (body: unknown, seen: Seen[]): typeof fetch =>
  ((url: string, init?: RequestInit) => {
    seen.push({
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }) as unknown as typeof fetch

/**
 * The catalog assembly and DTO parsing are the deterministic bridge from the
 * flat API lists to the Projects tree, so they are pinned: grouping by client and
 * project, the synthetic "No client" bucket for orphan projects, rate parsing, and
 * rejection of malformed payloads.
 */
describe('assembleCatalog', () => {
  const clients = [
    { id: 'c1', name: 'NexusHero' },
    { id: 'c2', name: 'Empty client' },
  ]
  const projects = [
    { id: 'p1', name: 'Finanzo', clientId: 'c1', hourlyRateOverride: '12000' },
    { id: 'p2', name: 'Loose ends', clientId: null, hourlyRateOverride: null },
  ]
  const tasks = [
    { id: 't1', name: 'Ledger', projectId: 'p1', archived: true },
    { id: 't2', name: 'UI', projectId: 'p1', archived: false },
  ]

  it('GroupsProjectsUnderClientAndTasksUnderProject', () => {
    const tree = assembleCatalog(clients, projects, tasks)
    const nexus = tree.find(c => c.id === 'c1')
    expect(nexus?.projects).toHaveLength(1)
    expect(nexus?.projects[0]?.tasks.map(t => t.name)).toEqual(['Ledger', 'UI'])
    expect(nexus?.projects[0]?.tasks[0]?.done).toBe(true) // archived → done
  })

  it('ParsesHourlyRateOverrideIntoMinorPerHour', () => {
    const tree = assembleCatalog(clients, projects, tasks)
    expect(tree.find(c => c.id === 'c1')?.projects[0]?.rateMinorPerHour).toBe(12_000)
  })

  it('OrphanProjects_LandInSyntheticNoClientBucket', () => {
    const tree = assembleCatalog(clients, projects, tasks)
    const orphan = tree.find(c => c.name === 'No client')
    expect(orphan?.projects.map(p => p.id)).toEqual(['p2'])
    expect(orphan?.projects[0]?.rateMinorPerHour).toBe(0)
  })

  it('DropsClientsWithNoProjects', () => {
    const tree = assembleCatalog(clients, projects, tasks)
    expect(tree.some(c => c.id === 'c2')).toBe(false)
  })

  it('EmptyCatalog_IsEmptyTree', () => {
    expect(assembleCatalog([], [], [])).toEqual([])
  })
})

describe('DTO parsers', () => {
  it('parseClients_ValidArray_ReturnsDtos', () => {
    expect(parseClients([{ id: 'c1', name: 'A', extra: 1 }])).toEqual([{ id: 'c1', name: 'A' }])
  })

  it('parseProjects_KeepsNullableFields', () => {
    expect(
      parseProjects([{ id: 'p1', name: 'P', clientId: null, hourlyRateOverride: null }]),
    ).toEqual([{ id: 'p1', name: 'P', clientId: null, hourlyRateOverride: null }])
  })

  it('parseTasks_CoercesArchivedToBoolean', () => {
    expect(parseTasks([{ id: 't1', name: 'T', projectId: 'p1' }])[0]?.archived).toBe(false)
  })

  it('MalformedPayload_Throws', () => {
    expect(() => parseClients([{ id: 5, name: 'A' }])).toThrow('expected string field "id"')
    expect(() => parseProjects('nope')).toThrow('expected an array')
  })

  it('parseProject_SingleRow_ReturnsDto', () => {
    expect(
      parseProject({ id: 'p9', name: 'Finanzo', clientId: null, hourlyRateOverride: null }),
    ).toEqual({ id: 'p9', name: 'Finanzo', clientId: null, hourlyRateOverride: null })
  })
})

describe('createProject', () => {
  it('CreateProject_PostsNameAndColor_ReturnsPersistedRow', async () => {
    const seen: Seen[] = []
    const persisted = { id: 'p-new', name: 'Finanzo', clientId: null, hourlyRateOverride: null }
    const fetchImpl = spyFetch(persisted, seen)

    const row = await createProject(
      'https://api.test',
      { name: 'Finanzo', color: '#3b82f6' },
      fetchImpl,
    )

    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe('https://api.test/api/tracking/projects')
    expect(seen[0]?.body).toEqual({ name: 'Finanzo', color: '#3b82f6' })
    expect(row).toEqual({ id: 'p-new', name: 'Finanzo', clientId: null, hourlyRateOverride: null })
  })
})
