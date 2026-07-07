import { Fragment } from 'react'
import { Icon } from './Icon'
import { fmtClock, fmtDur, projectById, type Block, type BreakSpan } from '../data'

const DAY_START = 6 * 60
const DAY_END = 20 * 60
const PPM = 1.05 // px pro Minute

const y = (min: number) => (Math.max(DAY_START, Math.min(min, DAY_END)) - DAY_START) * PPM
const CANVAS_H = (DAY_END - DAY_START) * PPM

interface Props {
  blocks: Block[]
  breaks: BreakSpan[]
  punchIn: number
  punchOut?: number
  punchedIn: boolean
  now: number
  onAcceptGhost: (id: string) => void
  onDismissGhost: (id: string) => void
  onGapClick: () => void
  onEditBlock: (id: string) => void
}

/**
 * Der Day Canvas (ux-vision §2.1): Außenspur = Stempelrahmen mit Pausen,
 * innen Projekt-/Meeting-Blöcke, Ghost-Blöcke = Co-Planer-Vorschläge,
 * Jetzt-Linie mit Zeit-Chip. Lücken sind sichtbar und antippbar.
 */
export function DayCanvas({ blocks, breaks, punchIn, punchOut, punchedIn, now, onAcceptGhost, onDismissGhost, onGapClick, onEditBlock }: Props) {
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)

  // Anwesenheits-Segmente: Stempelrahmen minus Pausen
  const frameEnd = punchedIn ? now : (punchOut ?? now)
  const segments: { start: number; end: number; open: boolean }[] = []
  let cursor = punchIn
  const sortedBreaks = [...breaks].sort((a, b) => a.start - b.start)
  for (const br of sortedBreaks) {
    const brEnd = Math.min(br.end, frameEnd)
    if (br.start > cursor) segments.push({ start: cursor, end: Math.min(br.start, frameEnd), open: false })
    cursor = Math.max(cursor, brEnd)
  }
  if (cursor < frameEnd) segments.push({ start: cursor, end: frameEnd, open: punchedIn })

  // Lücken zwischen Blöcken (nur Vergangenheit, > 15 min, innerhalb des Rahmens)
  const timeline = blocks
    .filter(b => b.status === 'actual' || b.status === 'running')
    .sort((a, b) => a.start - b.start)
  const gaps: { start: number; end: number }[] = []
  let gc = punchIn
  for (const b of timeline) {
    if (b.start - gc > 15) {
      const inBreak = sortedBreaks.some(br => gc >= br.start - 5 && b.start <= br.end + 5)
      if (!inBreak) gaps.push({ start: gc, end: b.start })
    }
    gc = Math.max(gc, b.end)
  }

  const nowY = y(now)

  return (
    <div className="canvas-scroll">
      <div className="canvas" style={{ height: CANVAS_H }}>
        {/* Stundenraster */}
        {hours.map(hm => (
          <Fragment key={hm}>
            <div className="gridline" style={{ top: y(hm) }} />
          </Fragment>
        ))}

        {/* Zeit-Lineal */}
        <div className="ruler" aria-hidden="true">
          {hours.map(hm => (
            <span key={hm} className="ruler-hour" style={{ top: y(hm) }}>
              {fmtClock(hm)}
            </span>
          ))}
        </div>

        {/* Anwesenheits-Spur */}
        <div className="att-rail" aria-label={`Anwesenheit seit ${fmtClock(punchIn)}`}>
          {segments.map((s, i) => (
            <div
              key={i}
              className={`att-seg ${s.open ? 'open' : ''}`}
              style={{ top: y(s.start), height: Math.max(4, y(s.end) - y(s.start)) }}
              title={`Anwesend ${fmtClock(s.start)}–${s.open ? 'jetzt' : fmtClock(s.end)}`}
            />
          ))}
          {sortedBreaks.map((br, i) => (
            <div key={`br${i}`} className="att-break" style={{ top: y(br.start), height: y(Math.min(br.end, frameEnd)) - y(br.start) }} title={`Pause ${fmtClock(br.start)}–${fmtClock(br.end)}`}>
              <Icon name="coffee" size={10} />
            </div>
          ))}
        </div>

        {/* Blöcke */}
        <div className="blocks">
          {gaps.map((g, i) => (
            <button
              key={`gap${i}`}
              className="gap-hint"
              style={{ top: y(g.start) + 3, height: y(g.end) - y(g.start) - 6 }}
              onClick={onGapClick}
              aria-label={`Lücke ${fmtClock(g.start)} bis ${fmtClock(g.end)} füllen`}
            >
              + {fmtDur(g.end - g.start)} zuordnen
            </button>
          ))}

          {blocks.map(b => {
            const proj = projectById(b.project)
            const end = b.status === 'running' ? now : b.end
            const height = Math.max(18, y(end) - y(b.start) - 2)
            const compact = height < 44
            const tiny = height < 30
            return (
              <div
                key={b.id}
                className={`block ${b.status} ${b.kind === 'meeting' ? 'meeting' : ''} ${tiny ? 'tiny' : ''} ${b.status !== 'ghost' ? 'editable' : ''}`}
                style={{ top: y(b.start) + 1, height, ['--pc' as string]: proj ? `var(--proj-${proj.slot})` : 'var(--ink-3)' }}
                title={b.status === 'ghost' ? `${b.title} · Vorschlag` : `${b.title} · antippen zum Bearbeiten`}
                role={b.status !== 'ghost' ? 'button' : undefined}
                tabIndex={b.status !== 'ghost' ? 0 : undefined}
                onClick={b.status !== 'ghost' ? () => onEditBlock(b.id) : undefined}
                onKeyDown={b.status !== 'ghost' ? e => e.key === 'Enter' && onEditBlock(b.id) : undefined}
              >
                <span className="b-title">
                  <span className="txt">{b.title}</span>
                  {b.hasTranscript && <span className="transcript-dot" title="Transkript vorhanden" />}
                </span>
                {!compact && (
                  <span className="b-meta">
                    <span className="time num">
                      {fmtClock(b.start)}–{b.status === 'running' ? 'jetzt' : fmtClock(b.end)} · {fmtDur(end - b.start)}
                    </span>
                    {proj && <span>{proj.name}</span>}
                    {b.source && <span className={`chip ${b.status === 'ghost' ? 'ai' : ''}`}>{b.source}</span>}
                    {b.status === 'running' && <span className="chip warn">läuft</span>}
                  </span>
                )}
                {b.status === 'ghost' && (
                  <span className="ghost-actions">
                    <button className="icon-btn ok" onClick={e => { e.stopPropagation(); onAcceptGhost(b.id) }} aria-label={`Vorschlag „${b.title}“ übernehmen`}>
                      <Icon name="check" size={13} />
                    </button>
                    <button className="icon-btn no" onClick={e => { e.stopPropagation(); onDismissGhost(b.id) }} aria-label={`Vorschlag „${b.title}“ verwerfen`}>
                      <Icon name="x" size={13} />
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Jetzt-Linie */}
        <div className="nowline" style={{ top: nowY }}>
          <span className="now-chip num">{fmtClock(now)}</span>
        </div>
      </div>
    </div>
  )
}
