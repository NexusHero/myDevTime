import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { fmtDur, parseQuickEntry, projectById } from '../data'
import type { View } from '../App'

interface Command {
  id: string
  label: string
  kind: string
  icon: string
  run: () => void
}

interface Props {
  onClose: () => void
  onNavigate: (v: View) => void
  onQuickEntry: (minutes: number, title: string, yesterday: boolean, project?: string) => void
  onTogglePunch: () => void
  onToggleBreak: () => void
}

/**
 * ⌘K-Command-Palette (ux-vision §2.4): ein Eingabefeld für Navigation,
 * Aktionen und Natural-Language-Zeiteinträge ("45m Code Review", "2h Doku gestern").
 */
export function Palette({ onClose, onNavigate, onQuickEntry, onTogglePunch, onToggleBreak }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const parsed = useMemo(() => parseQuickEntry(q), [q])

  const commands: Command[] = useMemo(
    () => [
      { id: 'nav-today', label: 'Heute öffnen', kind: 'Navigation', icon: 'today', run: () => onNavigate('today') },
      { id: 'nav-planner', label: 'Planer öffnen', kind: 'Navigation', icon: 'planner', run: () => onNavigate('planner') },
      { id: 'nav-projects', label: 'Projekte öffnen', kind: 'Navigation', icon: 'projects', run: () => onNavigate('projects') },
      { id: 'nav-reports', label: 'Berichte öffnen', kind: 'Navigation', icon: 'reports', run: () => onNavigate('reports') },
      { id: 'nav-meetings', label: 'Meetings öffnen', kind: 'Navigation', icon: 'meetings', run: () => onNavigate('meetings') },
      { id: 'act-punch', label: 'Ein-/Ausstempeln', kind: 'Aktion', icon: 'punch', run: onTogglePunch },
      { id: 'act-break', label: 'Pause starten/beenden', kind: 'Aktion', icon: 'coffee', run: onToggleBreak },
    ],
    [onNavigate, onTogglePunch, onToggleBreak],
  )

  const filtered = useMemo(() => {
    if (!q.trim() || parsed) return parsed ? [] : commands
    const needle = q.toLowerCase()
    return commands.filter(c => c.label.toLowerCase().includes(needle))
  }, [q, parsed, commands])

  const submit = () => {
    if (parsed) {
      onQuickEntry(parsed.minutes, parsed.title, parsed.yesterday, parsed.project)
      onClose()
      return
    }
    const cmd = filtered[idx]
    if (cmd) {
      cmd.run()
      onClose()
    }
  }

  return (
    <div
      className="palette-backdrop"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose()
        if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
        if (e.key === 'Enter') submit()
      }}
    >
      <div className="palette" role="dialog" aria-label="Befehle und Schnelleintrag" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setIdx(0) }}
          placeholder='Befehl suchen — oder Zeit erfassen: „45m Code Review“, „2h Finanzo Doku gestern“'
          aria-label="Befehl oder Zeiteintrag"
        />
        {parsed && (
          <div className="parse-preview">
            <Icon name="sparkle" size={16} />
            <span>
              Eintrag: <span className="num">{fmtDur(parsed.minutes)}</span> · <strong>{parsed.title}</strong>
              {parsed.project ? <> · {projectById(parsed.project)?.name}</> : null}
              {parsed.yesterday ? ' · gestern' : ' · heute'}
            </span>
            <span className="chip ai" style={{ marginLeft: 'auto' }}>↵ als Entwurf anlegen</span>
          </div>
        )}
        {!parsed && (
          <div className="palette-list">
            {filtered.map((c, i) => (
              <button
                key={c.id}
                className={`palette-item ${i === idx ? 'active' : ''}`}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { c.run(); onClose() }}
              >
                <Icon name={c.icon} size={16} />
                <span className="pi-label">{c.label}</span>
                <span className="pi-kind">{c.kind}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>
                Kein Befehl gefunden. Tipp: Dauer + Text ergibt einen Zeiteintrag — z.&nbsp;B. „30m Standup-Vorbereitung“.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
