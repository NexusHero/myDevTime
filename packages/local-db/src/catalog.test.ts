import { describe, expect, it } from 'vitest'
import { openTestDb } from './testing/node-sqlite.js'
import { createProject, createTask, listProjects, listTasks } from './catalog.js'

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
})
