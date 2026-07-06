import { useState } from 'react'
import { Icon } from './Icon'
import { fmtClock, fmtDur, projectById, type Block } from '../data'

interface Props {
  now: number
  running?: Block
  punchedIn: boolean
  onBreak: boolean
  onStop: () => void
  onStart: () => void
  onToggleBreak: () => void
  onTogglePunch: () => void
}

/**
 * Das „Island“ — der persistente Live-Zustand (ux-vision §2.3).
 * Kollabiert: Timer + Stempelstatus auf einen Blick. Tippen → Quick-Actions.
 */
export function Island({ now, running, punchedIn, onBreak, onStop, onStart, onToggleBreak, onTogglePunch }: Props) {
  const [open, setOpen] = useState(false)
  const proj = projectById(running?.project)

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
          <button className="btn btn-ghost btn-sm" onClick={onToggleBreak} disabled={!punchedIn}>
            <Icon name="coffee" size={14} /> {onBreak ? 'Pause beenden' : 'Pause'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onTogglePunch}>
            <Icon name="punch" size={14} /> {punchedIn ? 'Ausstempeln' : 'Einstempeln'}
          </button>
        </div>
      )}
      <button
        className={`island ${running ? '' : 'island-idle'}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Live-Status: Timer und Stempeluhr"
      >
        <span className="live-dot" />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <span className="i-title">
            {onBreak ? 'Pause läuft' : running ? running.title : 'Kein Timer aktiv'}
          </span>
          <span className="i-sub">
            {punchedIn ? `Eingestempelt seit 08:32 · jetzt ${fmtClock(now)}` : 'Ausgestempelt'}
            {proj ? ` · ${proj.name}` : ''}
          </span>
        </span>
        <span className="i-time num">{running ? fmtDur(now - running.start) : '—'}</span>
      </button>
    </div>
  )
}
