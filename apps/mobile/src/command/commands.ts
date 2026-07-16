import type { Screen } from '@mydevtime/design'

/**
 * The Command Bar's action model (design v10 §D11) — a pure, deterministic mapping
 * from the current app state to the ordered list of commands, plus a substring
 * filter. No side effects here: each command carries a typed `action` the component
 * dispatches to the real timer / worktime / navigation seams, so what the palette
 * offers is unit-tested without a running app.
 */
export type CommandAction =
  | { readonly type: 'timer-start' }
  | { readonly type: 'timer-pause' }
  | { readonly type: 'timer-resume' }
  | { readonly type: 'timer-stop' }
  | { readonly type: 'clock-in' }
  | { readonly type: 'clock-out' }
  | { readonly type: 'start-project'; readonly projectId: string; readonly name: string }
  | { readonly type: 'navigate'; readonly screen: Screen }
  | { readonly type: 'open-assistant' }

export interface Command {
  readonly id: string
  readonly group: string
  readonly label: string
  readonly action: CommandAction
}

export interface CommandContext {
  readonly timerRunning: boolean
  readonly timerPaused: boolean
  /** Whether a work-time shift is open (clocked in). */
  readonly punchedIn: boolean
  readonly projects: readonly { readonly id: string; readonly name: string }[]
  readonly destinations: readonly { readonly screen: Screen; readonly title: string }[]
}

/**
 * Build the ordered command list for the current state: the timer verbs that apply
 * now (start, or pause/resume + stop), the clock in/out toggle, "start on …" for
 * every real project, and "go to" for every navigable screen. English labels.
 */
export function buildCommands(ctx: CommandContext): Command[] {
  const active = ctx.timerRunning || ctx.timerPaused
  const timer: Command[] = active
    ? [
        ctx.timerPaused
          ? {
              id: 'timer-resume',
              group: 'Timer',
              label: 'Resume timer',
              action: { type: 'timer-resume' },
            }
          : {
              id: 'timer-pause',
              group: 'Timer',
              label: 'Pause timer',
              action: { type: 'timer-pause' },
            },
        { id: 'timer-stop', group: 'Timer', label: 'Stop timer', action: { type: 'timer-stop' } },
      ]
    : [{ id: 'timer-start', group: 'Timer', label: 'Start timer', action: { type: 'timer-start' } }]

  const punch: Command = ctx.punchedIn
    ? { id: 'clock-out', group: 'Timer', label: 'Clock out', action: { type: 'clock-out' } }
    : { id: 'clock-in', group: 'Timer', label: 'Clock in', action: { type: 'clock-in' } }

  const projects: Command[] = ctx.projects.map(p => ({
    id: `start:${p.id}`,
    group: 'Start on…',
    label: p.name,
    action: { type: 'start-project', projectId: p.id, name: p.name },
  }))

  const navigate: Command[] = ctx.destinations.map(d => ({
    id: `go:${d.screen}`,
    group: 'Go to',
    label: d.title,
    action: { type: 'navigate', screen: d.screen },
  }))

  // The Assistant is a layer, not a place (ADR-0063): `⌘K` opens the overlay rather
  // than routing to a tab. Always available, grouped on its own.
  const assistant: Command = {
    id: 'open-assistant',
    group: 'Assistant',
    label: 'Open Assistant',
    action: { type: 'open-assistant' },
  }

  return [...timer, punch, assistant, ...projects, ...navigate]
}

/** Case-insensitive substring filter over "group + label"; empty query keeps all. */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return [...commands]
  return commands.filter(c => `${c.group} ${c.label}`.toLowerCase().includes(q))
}
