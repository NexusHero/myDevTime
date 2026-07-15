import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { loadConfig } from '../config.js'
import { createAuth } from '../modules/auth/auth-instance.js'
import { resolveWorkspaceId } from '../core/workspace.js'
import * as schema from './schema.js'

const { user, clients, projects, tasks, timeEntries, attendanceShifts, workSchedules } = schema

type SeedMode = 'light' | 'medium' | 'intense'

async function main(): Promise<void> {
  const config = loadConfig()
  const DATABASE_URL = config.DATABASE_URL
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required to seed the database')
  }

  // Parse mode from process arguments or environment variables
  const args = process.argv.slice(2)
  const modeArg = args.find(arg => arg.startsWith('--mode='))
  const rawMode = (modeArg ? modeArg.split('=')[1] : null) ?? process.env.SEED_MODE ?? 'light'

  const mode: SeedMode = ['light', 'medium', 'intense'].includes(rawMode)
    ? (rawMode as SeedMode)
    : 'light'

  console.log(`\n==========================================`)
  console.log(`🌱 Seeding database in mode: [${mode.toUpperCase()}]`)
  console.log(`==========================================\n`)

  const sqlConnection = postgres(DATABASE_URL, { max: 1 })
  const db = drizzle(sqlConnection, { schema })

  const emailMock = {
    send: () => Promise.resolve(),
  }

  const auth = createAuth({ db, config, email: emailMock })

  try {
    const adminEmail = 'admin@test.de'
    const adminName = 'Admin User'
    const adminPassword = 'Password123!'

    // 1. Ensure admin user exists
    let adminUser = await db
      .select()
      .from(user)
      .where(eq(user.email, adminEmail))
      .limit(1)
      .then(r => r[0])

    if (!adminUser) {
      console.log(`+ Creating admin user: ${adminEmail}`)
      const signupRes = await auth.api.signUpEmail({
        body: {
          email: adminEmail,
          password: adminPassword,
          name: adminName,
        },
      })
      adminUser = {
        id: signupRes.user.id,
        email: signupRes.user.email,
        name: signupRes.user.name,
        emailVerified: signupRes.user.emailVerified,
        createdAt: signupRes.user.createdAt,
        updatedAt: signupRes.user.updatedAt,
        image: signupRes.user.image ?? null,
      }
    } else {
      console.log(`- Admin user ${adminEmail} already exists.`)
    }

    // 2. Resolve/provision workspace
    const workspaceId = await resolveWorkspaceId(db, adminUser.id, adminUser.name)
    console.log(`Workspace ID: ${workspaceId}`)

    // Clean up existing entries for this workspace to ensure clean state for the selected mode
    console.log('Cleaning up existing data in workspace to apply new mode...')
    await db.delete(timeEntries).where(eq(timeEntries.workspaceId, workspaceId))
    await db.delete(attendanceShifts).where(eq(attendanceShifts.workspaceId, workspaceId))
    await db.delete(tasks).where(eq(tasks.workspaceId, workspaceId))
    await db.delete(projects).where(eq(projects.workspaceId, workspaceId))
    await db.delete(clients).where(eq(clients.workspaceId, workspaceId))

    // Set up weekly target schedule (40h/week: 8h/day Mon-Fri)
    const existingSchedule = await db
      .select()
      .from(workSchedules)
      .where(eq(workSchedules.workspaceId, workspaceId))
      .limit(1)
      .then(r => r[0])
    if (!existingSchedule) {
      const hourMs = 60 * 60 * 1000
      await db.insert(workSchedules).values({
        workspaceId,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        weeklyTargetMs: [8 * hourMs, 8 * hourMs, 8 * hourMs, 8 * hourMs, 8 * hourMs, 0, 0],
      })
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // ==========================================
    // 1. LIGHT MODE: 1 Client, 1 Project, 3 Tasks, 2 Entries, Compliant Shifts
    // ==========================================
    if (mode === 'light') {
      console.log('Applying LIGHT dataset...')

      const [client] = await db
        .insert(clients)
        .values({ workspaceId, name: 'Acme Corp' })
        .returning()
      if (!client) throw new Error('Failed to insert client')

      const [project] = await db
        .insert(projects)
        .values({
          workspaceId,
          clientId: client.id,
          name: 'Website Relaunch',
          color: '#2563EB',
        })
        .returning()
      if (!project) throw new Error('Failed to insert project')

      const [task1, task2, _task3] = await db
        .insert(tasks)
        .values([
          { workspaceId, projectId: project.id, name: 'React Frontend' },
          { workspaceId, projectId: project.id, name: 'UI Mockups' },
          { workspaceId, projectId: project.id, name: 'Documentation' },
        ])
        .returning()
      if (!task1 || !task2) throw new Error('Failed to insert tasks')

      // Time Entries (yesterday & today)
      await db.insert(timeEntries).values([
        {
          workspaceId,
          userId: adminUser.id,
          projectId: project.id,
          taskId: task2.id,
          startedAt: new Date(`${yesterdayStr}T14:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T15:00:00Z`), // 1h
          note: 'Created initial wireframes',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: project.id,
          taskId: task1.id,
          startedAt: new Date(`${todayStr}T10:00:00Z`),
          endedAt: new Date(`${todayStr}T12:00:00Z`), // 2h
          note: 'Coding header navigation component',
          source: 'manual',
        },
      ])

      // Compliant Shifts (3h yesterday, 2h today - no breaks required for <=6h)
      await db.insert(attendanceShifts).values([
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${yesterdayStr}T14:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T17:00:00Z`),
          breakMs: 0,
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${todayStr}T10:00:00Z`),
          endedAt: new Date(`${todayStr}T12:00:00Z`),
          breakMs: 0,
          source: 'manual',
        },
      ])
    }

    // ==========================================
    // 2. MEDIUM MODE: 2 Clients, 3 Projects, 6 Tasks, Compliant 8h Shifts
    // ==========================================
    if (mode === 'medium') {
      console.log('Applying MEDIUM dataset...')

      const [acme] = await db.insert(clients).values({ workspaceId, name: 'Acme Corp' }).returning()
      const [stark] = await db
        .insert(clients)
        .values({ workspaceId, name: 'Stark Industries' })
        .returning()
      if (!acme || !stark) throw new Error('Failed to insert clients')

      const [web, seo] = await db
        .insert(projects)
        .values([
          { workspaceId, clientId: acme.id, name: 'Website Relaunch', color: '#2563EB' },
          { workspaceId, clientId: acme.id, name: 'SEO Optimization', color: '#10B981' },
        ])
        .returning()
      const [suit] = await db
        .insert(projects)
        .values([
          { workspaceId, clientId: stark.id, name: 'Iron Suit Maintenance', color: '#DC2626' },
        ])
        .returning()
      if (!web || !seo || !suit) throw new Error('Failed to insert projects')

      const [tReact, tBugs] = await db
        .insert(tasks)
        .values([
          { workspaceId, projectId: web.id, name: 'React Development' },
          { workspaceId, projectId: web.id, name: 'Bug Fixing' },
        ])
        .returning()
      const [tKeywords] = await db
        .insert(tasks)
        .values([{ workspaceId, projectId: seo.id, name: 'Keyword Research' }])
        .returning()
      const [tCharging] = await db
        .insert(tasks)
        .values([{ workspaceId, projectId: suit.id, name: 'Reactor Charging' }])
        .returning()
      if (!tReact || !tBugs || !tKeywords || !tCharging) throw new Error('Failed to insert tasks')

      // Time entries for yesterday & today
      await db.insert(timeEntries).values([
        {
          workspaceId,
          userId: adminUser.id,
          projectId: web.id,
          taskId: tReact.id,
          startedAt: new Date(`${yesterdayStr}T09:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T13:00:00Z`), // 4h
          note: 'Developing landing page hero',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: suit.id,
          taskId: tCharging.id,
          startedAt: new Date(`${yesterdayStr}T14:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T18:00:00Z`), // 4h
          note: 'Charging core and running tests',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: seo.id,
          taskId: tKeywords.id,
          startedAt: new Date(`${todayStr}T09:00:00Z`),
          endedAt: new Date(`${todayStr}T13:00:00Z`), // 4h
          note: 'Analyzing local search rankings',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: web.id,
          taskId: tBugs.id,
          startedAt: new Date(`${todayStr}T14:00:00Z`),
          endedAt: new Date(`${todayStr}T17:00:00Z`), // 3h
          note: 'Resolving header padding issues',
          source: 'manual',
        },
      ])

      // Standard shifts (8h net, 1h break)
      await db.insert(attendanceShifts).values([
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${yesterdayStr}T09:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T18:00:00Z`),
          breakMs: 60 * 60 * 1000,
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${todayStr}T09:00:00Z`),
          endedAt: new Date(`${todayStr}T18:00:00Z`),
          breakMs: 60 * 60 * 1000,
          source: 'manual',
        },
      ])
    }

    // ==========================================
    // 3. INTENSE MODE: 3 Clients, 4 Projects, 10 Tasks, Burnout/Non-Compliant Shifts (>10h work, 0 break)
    // ==========================================
    if (mode === 'intense') {
      console.log('Applying INTENSE dataset...')

      const [acme] = await db.insert(clients).values({ workspaceId, name: 'Acme Corp' }).returning()
      const [stark] = await db
        .insert(clients)
        .values({ workspaceId, name: 'Stark Industries' })
        .returning()
      const [wayne] = await db
        .insert(clients)
        .values({ workspaceId, name: 'Wayne Enterprises' })
        .returning()
      if (!acme || !stark || !wayne) throw new Error('Failed to insert clients')

      const [web, seo] = await db
        .insert(projects)
        .values([
          { workspaceId, clientId: acme.id, name: 'Website Relaunch', color: '#2563EB' },
          { workspaceId, clientId: acme.id, name: 'SEO Optimization', color: '#10B981' },
        ])
        .returning()
      const [suit] = await db
        .insert(projects)
        .values([
          { workspaceId, clientId: stark.id, name: 'Iron Suit Maintenance', color: '#DC2626' },
        ])
        .returning()
      const [batmobile] = await db
        .insert(projects)
        .values([
          { workspaceId, clientId: wayne.id, name: 'Batmobile Calibration', color: '#1E293B' },
        ])
        .returning()
      if (!web || !seo || !suit || !batmobile) throw new Error('Failed to insert projects')

      // Tasks
      const [tReact, _tBugs] = await db
        .insert(tasks)
        .values([
          { workspaceId, projectId: web.id, name: 'React Development' },
          { workspaceId, projectId: web.id, name: 'Bug Fixing' },
        ])
        .returning()
      const [_tKeywords] = await db
        .insert(tasks)
        .values([{ workspaceId, projectId: seo.id, name: 'Keyword Research' }])
        .returning()
      const [tCharging, _tArmor] = await db
        .insert(tasks)
        .values([
          { workspaceId, projectId: suit.id, name: 'Reactor Charging' },
          { workspaceId, projectId: suit.id, name: 'Armor Plating Repair' },
        ])
        .returning()
      const [tThrusters, tWeaponry] = await db
        .insert(tasks)
        .values([
          { workspaceId, projectId: batmobile.id, name: 'Afterburner Diagnostics' },
          { workspaceId, projectId: batmobile.id, name: 'Grappling Hook Install' },
        ])
        .returning()
      if (!tReact || !tCharging || !tThrusters || !tWeaponry)
        throw new Error('Failed to insert tasks')

      // Overbooked time entries
      await db.insert(timeEntries).values([
        {
          workspaceId,
          userId: adminUser.id,
          projectId: web.id,
          taskId: tReact.id,
          startedAt: new Date(`${yesterdayStr}T07:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T13:00:00Z`), // 6h
          note: 'Heavy refactoring of landing page layout',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: batmobile.id,
          taskId: tThrusters.id,
          startedAt: new Date(`${yesterdayStr}T13:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T18:30:00Z`), // 5.5h
          note: 'Afterburner calibration and thruster adjustments',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: suit.id,
          taskId: tCharging.id,
          startedAt: new Date(`${todayStr}T08:00:00Z`),
          endedAt: new Date(`${todayStr}T13:00:00Z`), // 5h
          note: 'Critical charging loop troubleshooting',
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          projectId: batmobile.id,
          taskId: tWeaponry.id,
          startedAt: new Date(`${todayStr}T13:00:00Z`),
          endedAt: new Date(`${todayStr}T17:30:00Z`), // 4.5h
          note: 'Weaponry alignment under pressure',
          source: 'manual',
        },
      ])

      // Burnout shifts: 11.5 hours yesterday and 9.5 hours today, BOTH with 0 breakMs.
      // This will heavily trigger ArbZG warnings and massive overtime balance!
      await db.insert(attendanceShifts).values([
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${yesterdayStr}T07:00:00Z`),
          endedAt: new Date(`${yesterdayStr}T18:30:00Z`), // 11.5 hours
          breakMs: 0,
          source: 'manual',
        },
        {
          workspaceId,
          userId: adminUser.id,
          startedAt: new Date(`${todayStr}T08:00:00Z`),
          endedAt: new Date(`${todayStr}T17:30:00Z`), // 9.5 hours
          breakMs: 0,
          source: 'manual',
        },
      ])
    }

    console.log(`✓ Seeding complete in mode: ${mode.toUpperCase()}!`)
  } catch (error) {
    console.error('Seeding failed:', error)
  } finally {
    await sqlConnection.end({ timeout: 5 })
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
