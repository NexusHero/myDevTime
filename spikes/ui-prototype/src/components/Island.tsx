import { useState } from 'react'
import { Icon } from './Icon'
import { fmtClock, fmtDur, projectById, type Block } from '../data'

export interface FocusState {
  endsAt: number
  cycle: number
  totalCycles: number
}

interface Props {
  now: number
  running?: Block
  punchedIn: boolean
  onBreak: boolean
  focus: FocusState | null
  onStop: () => void
  onStart: () => void
  onToggleBreak: () => void
  onTogglePunch: () => void
  onToggleFocus: () => void
}

/**
 * Das „Island“ — der persistente Live-Zustand (ux-vision §2.3).
 * Kollabiert: Timer + Stempelstatus auf einen Blick. Tippen → Quick-Actions.
 */
export function Island({ now, running, punchedIn, onBreak, focus, onStop, onStart, onToggleBreak, onTogglePunch, onToggleFocus }: Props) {
  const [open, setOpen] = useState(false)
  const proj = projectById(running?.project)
  const focusLeft = focus ? Math.max(0, focus.endsAt - now) : 0

  return (
    <div className="island-wrap">
      {open && (
        <div className="island-expand" role="menu" aria-label="Schnellaktionen">
          {running ? (
            <button className="btn btn-ghost btn-sm" onClick={onStop}>
              <Icon name="stop" size={14} /> Timer stoppen
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onStart}>
              <Icon name="play" size={14} /> Timer starten
            </button>
          )}
          <button className={`btn btn-sm ${focus ? 'btn-primary' : 'btn-ghost'}`} onClick={onToggleFocus} disabled={!running && !focus}>
            <Icon name="sparkle" size={14} /> {focus ? 'Fokus beenden' : 'Fokus 25/5'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onToggleBreak} disabled={!punchedIn}>
            <Icon name="coffee" size={14} /> {onBreak ? 'Pause beenden' : 'Pause'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onTogglePunch}>
            <Icon name="punch" size={14} /> {punchedIn ? 'Ausstempeln' : 'Einstempeln'}
          </button>
        </div>
      )}
      <button
        className={`island ${running ? '' : 'island-idle'} ${focus ? 'island-focus' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Live-Status: Timer, Fokus und Stempeluhr"
      >
        <span className="live-dot" />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <span className="i-title">
            {focus ? `Fokus · ${running?.title ?? 'Session'}` : onBreak ? 'Pause läuft' : running ? running.title : 'Kein Timer aktiv'}
          </span>
          <span className="i-sub">
            {focus
              ? `Zyklus ${focus.cycle}/${focus.totalCycles} · DND aktiv · danach 5 min Pause`
              : `${punchedIn ? `Eingestempelt seit 08:32 · jetzt ${fmtClock(now)}` : 'Ausgestempelt'}${proj ? ` · ${proj.name}` : ''}`}
          </span>
        </span>
        <span className="i-time num">
          {focus ? fmtDur(focusLeft) : running ? fmtDur(now - running.start) : '—'}
        </span>
      </button>
    </div>
  )
}
