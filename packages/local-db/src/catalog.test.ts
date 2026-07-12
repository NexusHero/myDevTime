import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import {
  createClient,
  createProject,
  createTask,
  listAllTasks,
  listClients,
  listProjects,
  listTasks,
} from './catalog.js'

const WS = 'ws-1'
const OTHER = 'ws-2'

describe('catalog repository', () => {
  it('CreateProject_RoundTrips_AndListsByName', async () => {
    const db = await openTestDb()
    await createProject(db, WS, { name: 'Zeta' })
    await createProject(db, WS, { name: 'Alpha', color: '#fff', clientId: 'c1' })
    const projects = await listProjects(db, WS)
    expect(projects.map(p => p.name)).toEqual(['Alpha', 'Zeta'])
    expect(projects[0]?.color).toBe('#fff')
    expect(projects[0]?.clientId).toBe('c1')
    expect(projects[0]?.billableDefault).toBe(true)
  })

  it('CreateTask_RoundTrips_UnderItsProject', async () => {
    const db = await openTestDb()
    const project = await createProject(db, WS, { name: 'P' })
    await createTask(db, WS, project.id, 'Design')
    const tasks = await listTasks(db, WS, project.id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.name).toBe('Design')
    expect(tasks[0]?.projectId).toBe(project.id)
  })

  it('Catalog_IsWorkspaceIsolated', async () => {
    const db = await openTestDb()
    const mine = await createProject(db, WS, { name: 'Mine' })
    await createTask(db, WS, mine.id, 'T')
    // ws-2 sees none of ws-1's projects or tasks.
    expect(await listProjects(db, OTHER)).toHaveLength(0)
    expect(await listTasks(db, OTHER, mine.id)).toHaveLength(0)
  })

  it('Clients_RoundTrip_AndAreWorkspaceIsolated', async () => {
    const db = await openTestDb()
    await createClient(db, WS, 'Zeta Co')
    await createClient(db, WS, 'Acme')
    const clients = await listClients(db, WS)
    expect(clients.map(c => c.name)).toEqual(['Acme', 'Zeta Co'])
    expect(await listClients(db, OTHER)).toHaveLength(0)
  })

  it('ListAllTasks_ReturnsEveryProjectsTasks', async () => {
    const db = await openTestDb()
    const a = await createProject(db, WS, { name: 'A' })
    const b = await createProject(db, WS, { name: 'B' })
    await createTask(db, WS, a.id, 'a1')
    await createTask(db, WS, b.id, 'b1')
    const all = await listAllTasks(db, WS)
    expect(all.map(t => t.name).sort()).toEqual(['a1', 'b1'])
    expect(await listAllTasks(db, OTHER)).toHaveLength(0)
  })
})
