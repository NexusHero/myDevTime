import { DayCanvas } from '../components/DayCanvas'
import { Icon } from '../components/Icon'
import { fmtDur, fmtClock, type Block, type BreakSpan } from '../data'

interface Props {
  blocks: Block[]
  breaks: BreakSpan[]
  punchIn: number
  punchedIn: boolean
  now: number
  onAcceptGhost: (id: string) => void
  onDismissGhost: (id: string) => void
  onAcceptAll: () => void
  onDismissAll: () => void
  onGapClick: () => void
}

export function Today(props: Props) {
  const { blocks, breaks, punchIn, punchedIn, now } = props
  const ghosts = blocks.filter(b => b.status === 'ghost')

  // Kennzahlen deterministisch aus den Blöcken/Stempeldaten abgeleitet
  const tracked = blocks
    .filter(b => b.status === 'actual' || b.status === 'running')
    .reduce((sum, b) => sum + ((b.status === 'running' ? now : b.end) - b.start), 0)
  const breakMin = breaks.reduce((s, br) => s + (Math.min(br.end, now) - br.start), 0)
  const presence = (punchedIn ? now : now) - punchIn - breakMin
  const billable = blocks
    .filter(b => (b.status === 'actual' || b.status === 'running') && b.billable)
    .reduce((sum, b) => sum + ((b.status === 'running' ? now : b.end) - b.start), 0)
  const coverage = presence > 0 ? Math.round((tracked / presence) * 100) : 0
  const ghostMin = ghosts.reduce((s, g) => s + (g.end - g.start), 0)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Heute</h1>
        <span className="page-sub">Donnerstag · eingestempelt {fmtClock(punchIn)} · Soll 8:00 h</span>
      </div>

      <div className="today-grid">
        <section className="card canvas-card" aria-label="Tagesverlauf">
          <div className="canvas-head">
            <h2>Day Canvas</h2>
            <span className="chip">
              <span className="dot" style={{ background: 'var(--accent)' }} />
              Jetzt-Linie · {fmtClock(now)}
            </span>
          </div>
          <DayCanvas {...props} />
        </section>

        <aside className="today-rail">
          {ghosts.length > 0 && (
            <section className="card card-pad briefing" aria-label="Co-Planer-Vorschlag">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="sparkle" size={14} /> Co-Planer
              </div>
              <p>
                Rest des Tages: <strong>Sprint-Review 15:00</strong> ist fix. Davor und danach passen{' '}
                <strong className="num">{fmtDur(ghostMin)}</strong> Fokuszeit — Vorschlag: Sync-Engine zuerst
                (Deadline Fr.), Finanzo-Doku nach dem Review (Budget 88 %).
              </p>
              <div className="briefing-row">
                <button className="btn btn-primary btn-sm" onClick={props.onAcceptAll}>
                  <Icon name="check" size={14} /> Alle übernehmen
                </button>
                <button className="btn btn-ghost btn-sm" onClick={props.onDismissAll}>Verwerfen</button>
              </div>
              <div className="credit-note">
                <Icon name="sparkle" size={12} /> 1 AI-Credit · Modell-Vorschlag, Blöcke bleiben Entwurf bis du sie übernimmst
              </div>
            </section>
          )}

          <section className="card card-pad" aria-label="Tageszusammenfassung">
            <div className="card-title">Tag im Blick</div>
            <div className="summary-list">
              <div className="summary-item">
                <span className="lbl">Anwesenheit (netto)</span>
                <span className="val num">{fmtDur(presence)}</span>
              </div>
              <div className="summary-item">
                <span className="lbl">Auf Projekte erfasst</span>
                <span className="val num">{fmtDur(tracked)}</span>
              </div>
              <div className="summary-item">
                <span className="lbl">Abdeckung</span>
                <span className="val">
                  <span className={`chip ${coverage >= 85 ? 'good' : 'warn'}`}>{coverage} %</span>
                </span>
              </div>
              <div className="summary-item">
                <span className="lbl">Abrechenbar</span>
                <span className="val num">{fmtDur(billable)}</span>
              </div>
              <div className="summary-item">
                <span className="lbl">Pause</span>
                <span className="val num">{fmtDur(breakMin)}</span>
              </div>
            </div>
          </section>

          <section className="card card-pad" aria-label="Pausenregel">
            <div className="card-title">Pausenregel (ArbZG-Preset)</div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
              30&nbsp;min bei &gt;6&nbsp;h erfüllt <span className="chip good" style={{ marginLeft: 4 }}>✓ konform</span>
              <br />
              <span style={{ color: 'var(--ink-3)', fontSize: 'var(--fs-xs)' }}>
                Ab 9:00 h Arbeitszeit werden 45 min fällig — Hinweis erscheint hier.
              </span>
            </p>
          </section>
        </aside>
      </div>
    </>
  )
}
