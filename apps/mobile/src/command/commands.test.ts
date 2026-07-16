import { describe, expect, it } from 'vitest'
import { buildCommands, filterCommands, type CommandContext } from './commands.js'

const base: CommandContext = {
  timerRunning: false,
  timerPaused: false,
  punchedIn: false,
  projects: [{ id: 'p1', name: 'Finanzo AG' }],
  destinations: [
    { screen: 'today', title: 'Today' },
    { screen: 'reports', title: 'Reports' },
  ],
}

describe('buildCommands', () => {
  it('Idle_OffersStartTimerAndClockIn', () => {
    const ids = buildCommands(base).map(c => c.id)
    expect(ids).toContain('timer-start')
    expect(ids).toContain('clock-in')
    expect(ids).not.toContain('timer-pause')
  })

  it('Running_OffersPauseAndStop', () => {
    const ids = buildCommands({ ...base, timerRunning: true }).map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining(['timer-pause', 'timer-stop']))
    expect(ids).not.toContain('timer-start')
  })

  it('Paused_OffersResumeAndStop', () => {
    const ids = buildCommands({ ...base, timerPaused: true }).map(c => c.id)
    expect(ids).toEqual(expect.arrayContaining(['timer-resume', 'timer-stop']))
  })

  it('PunchedIn_OffersClockOut', () => {
    const ids = buildCommands({ ...base, punchedIn: true }).map(c => c.id)
    expect(ids).toContain('clock-out')
    expect(ids).not.toContain('clock-in')
  })

  it('EmitsAStartCommandPerProject_AndANavCommandPerDestination', () => {
    const cmds = buildCommands(base)
    expect(cmds.find(c => c.id === 'start:p1')?.action).toEqual({
      type: 'start-project',
      projectId: 'p1',
      name: 'Finanzo AG',
    })
    expect(cmds.find(c => c.id === 'go:reports')?.action).toEqual({
      type: 'navigate',
      screen: 'reports',
    })
  })
})

describe('filterCommands', () => {
  it('EmptyQuery_KeepsAll', () => {
    const cmds = buildCommands(base)
    expect(filterCommands(cmds, '   ')).toHaveLength(cmds.length)
  })

  it('MatchesGroupOrLabel_CaseInsensitively', () => {
    const cmds = buildCommands(base)
    expect(filterCommands(cmds, 'finanzo').map(c => c.id)).toEqual(['start:p1'])
    expect(filterCommands(cmds, 'go to').map(c => c.action.type)).toEqual(['navigate', 'navigate'])
  })
})
