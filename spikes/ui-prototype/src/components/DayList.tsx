import { Icon } from './Icon'
import { fmtClock, fmtDur, projectById, type Block, type BreakSpan } from '../data'

interface Props {
  blocks: Block[]
  breaks: BreakSpan[]
  now: number
  onAcceptGhost: (id: string) => void
  onDismissGhost: (id: string) => void
  onEditBlock: (id: string) => void
}

/**
 * Klassische Tagesliste (REQ-040): dieselben Daten und Aktionen wie der Canvas,
 * als dichte, tastatur- und screenreader-freundliche Liste — mit €-Betrag je
 * abrechenbarem Eintrag und Tagessumme.
 */
export function DayList({ blocks, breaks, now, onAcceptGhost, onDismissGhost, onEditBlock }: Props) {
  type Row = { kind: 'block'; b: Block } | { kind: 'break'; br: BreakSpan }
  const rows: Row[] = [
    ...blocks.map(b => ({ kind: 'block' as const, b })),
    ...breaks.map(br => ({ kind: 'break' as const, br })),
  ].sort((a, b) => (a.kind === 'block' ? a.b.start : a.br.start) - (b.kind === 'block' ? b.b.start : b.br.start))

  const amount = (b: Block) => {
    const p = projectById(b.project)
    if (!b.billable || !p || p.rate <= 0) return null
    const end = b.status === 'running' ? now : b.end
    return ((end - b.start) / 60) * p.rate
  }

  const done = blocks.filter(b => b.status === 'actual' || b.status === 'running')
  const totalMin = done.reduce((s, b) => s + ((b.status === 'running' ? now : b.end) - b.start), 0)
  const totalAmount = done.reduce((s, b) => s + (amount(b) ?? 0), 0)

  return (
    <div className="daylist" role="list" aria-label="Tagesliste">
      {rows.map((r, i) => {
        if (r.kind === 'break') {
          return (
            <div key={`br${i}`} className="dl-row dl-break" role="listitem">
              <span className="dl-time num">{fmtClock(r.br.start)}–{fmtClock(Math.min(r.br.end, now))}</span>
              <span className="dl-main" style={{ color: 'var(--ink-3)' }}>
                <Icon name="coffee" size={13} /> Pause
              </span>
              <span className="dl-dur num">{fmtDur(Math.min(r.br.end, now) - r.br.start)}</span>
              <span className="dl-amt" />
            </div>
          )
        }
        const b = r.b
        const p = projectById(b.project)
        const end = b.status === 'running' ? now : b.end
        const amt = amount(b)
        const ghost = b.status === 'ghost'
        return (
          <div
            key={b.id}
            className={`dl-row ${ghost ? 'dl-ghost' : ''} ${b.status === 'running' ? 'dl-running' : ''}`}
            role="listitem"
          >
            <span className="dl-time num">{fmtClock(b.start)}–{b.status === 'running' ? 'jetzt' : fmtClock(b.end)}</span>
            <button
              className="dl-main"
              onClick={() => (ghost ? undefined : onEditBlock(b.id))}
              disabled={ghost}
              aria-label={ghost ? `${b.title} (Vorschlag)` : `${b.title} bearbeiten`}
            >
              <span className="dot" style={{ background: p ? `var(--proj-${p.slot})` : 'var(--ink-3)' }} />
              <span className="dl-title">
                {b.title}
                {b.note && <Icon name="doc" size={11} />}
                {b.hasTranscript && <span className="transcript-dot" title="Transkript" />}
              </span>
              {b.status === 'running' && <span className="chip warn">läuft</span>}
              {b.status === 'planned' && <span className="chip">geplant</span>}
              {ghost && <span className="chip ai">KI-Vorschlag</span>}
            </button>
            <span className="dl-dur num">{fmtDur(end - b.start)}</span>
            <span className="dl-amt num">{amt !== null ? `${amt.toFixed(0)} €` : ''}</span>
            {ghost && (
              <span style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn ok" onClick={() => onAcceptGhost(b.id)} aria-label="Vorschlag übernehmen"><Icon name="check" size={13} /></button>
                <button className="icon-btn no" onClick={() => onDismissGhost(b.id)} aria-label="Vorschlag verwerfen"><Icon name="x" size={13} /></button>
              </span>
            )}
          </div>
        )
      })}
      <div className="dl-row dl-foot">
        <span className="dl-time" />
        <span className="dl-main" style={{ fontWeight: 700 }}>Summe (erfasst)</span>
        <span className="dl-dur num" style={{ fontWeight: 700 }}>{fmtDur(totalMin)}</span>
        <span className="dl-amt num" style={{ fontWeight: 700 }}>{totalAmount.toFixed(0)} €</span>
      </div>
    </div>
  )
}
