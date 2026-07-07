import { DayCanvas } from '../components/DayCanvas'
import { Icon } from '../components/Icon'
import { fmtDur, fmtClock, type Block, type BreakSpan } from '../data'

interface Props {
  blocks: Block[]
  breaks: BreakSpan[]
  punchIn: number
  punchedIn: boolean
  now: number
  targetMin: number
  maxMin: number
  onTargetChange: (min: number) => void
  onMaxChange: (min: number) => void
  onTogglePunch: () => void
  onAcceptGhost: (id: string) => void
  onDismissGhost: (id: string) => void
  onAcceptAll: () => void
  onDismissAll: () => void
  onGapClick: () => void
  onOpenReview: () => void
}

/** Stepper für Arbeitszeit-Limits (30-min-Schritte). */
function TimeStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper-row">
      <span className="lbl">{label}</span>
      <span className="stepper">
        <button className="icon-btn" onClick={() => onChange(Math.max(min, value - 30))} aria-label={`${label} verringern`}>−</button>
        <span className="num stepper-val">{fmtDur(value)}</span>
        <button className="icon-btn" onClick={() => onChange(Math.min(max, value + 30))} aria-label={`${label} erhöhen`}>+</button>
      </span>
    </div>
  )
}

export function Today(props: Props) {
  const { blocks, breaks, punchIn, punchedIn, now, targetMin, maxMin } = props
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

  // Arbeitszeit-Status gegen Soll/Max (deterministisch)
  const remainingToMax = maxMin - presence
  const overMax = remainingToMax <= 0
  const nearMax = !overMax && remainingToMax <= 60
  const overTarget = presence >= targetMin

  return (
    <>
      <div className="page-head" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <h1 className="page-title">Heute</h1>
          <span className="page-sub">Donnerstag · Soll {fmtDur(targetMin)} · Max {fmtDur(maxMin)}</span>
        </span>
        <button
          className={`punch-cta ${punchedIn ? 'live' : ''}`}
          onClick={props.onTogglePunch}
          aria-label={punchedIn ? 'Arbeitszeit läuft — ausstempeln' : 'Einstempeln'}
        >
          {punchedIn ? (
            <>
              <span className="live-dot" />
              <span className="pc-text">
                <span className="pc-title">Arbeitszeit läuft</span>
                <span className="pc-sub">seit {fmtClock(punchIn)} · <span className="num">{fmtDur(presence)}</span> netto</span>
              </span>
              <span className="pc-action">Ausstempeln</span>
            </>
          ) : (
            <>
              <Icon name="punch" size={18} />
              <span className="pc-title">Einstempeln</span>
            </>
          )}
        </button>
      </div>

      {(overMax || nearMax) && (
        <div className={`worktime-alert ${overMax ? 'crit' : 'warn'}`} role="alert">
          {overMax
            ? <>Max. Arbeitszeit ({fmtDur(maxMin)}) überschritten — bitte ausstempeln. Der Nachweis markiert diesen Tag.</>
            : <>Noch <span className="num">{fmtDur(remainingToMax)}</span> bis zur max. Arbeitszeit ({fmtDur(maxMin)}).</>}
        </div>
      )}

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

          <section className="card card-pad" aria-label="Arbeitszeit heute">
            <div className="card-title">Arbeitszeit heute</div>
            <div className="worktime-bar" role="img" aria-label={`${fmtDur(presence)} von maximal ${fmtDur(maxMin)}`}>
              <div
                className={`wt-fill ${overMax ? 'over' : ''}`}
                style={{ width: `${Math.min(100, (presence / maxMin) * 100)}%` }}
              />
              <div className="wt-target" style={{ left: `${(targetMin / maxMin) * 100}%` }} title={`Soll ${fmtDur(targetMin)}`} />
            </div>
            <div className="wt-scale">
              <span className="num">{fmtDur(presence)}</span>
              <span>Soll {fmtDur(targetMin)}</span>
              <span>Max {fmtDur(maxMin)}</span>
            </div>
            <div style={{ marginTop: 'var(--sp-2)' }}>
              {overMax
                ? <span className="chip crit">Max überschritten</span>
                : overTarget
                  ? <span className="chip warn">Soll erreicht — Rest ist Überstunden</span>
                  : <span className="chip good">Noch {fmtDur(targetMin - presence)} bis Soll</span>}
            </div>
            <div className="stepper-group">
              <TimeStepper label="Soll-Arbeitszeit" value={targetMin} min={4 * 60} max={maxMin} onChange={props.onTargetChange} />
              <TimeStepper label="Max. Arbeitszeit" value={maxMin} min={targetMin} max={12 * 60} onChange={props.onMaxChange} />
            </div>
          </section>

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

          <section className="card card-pad" aria-label="Tag abschließen">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkle" size={14} /> Abend-Review
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginBottom: 'var(--sp-3)' }}>
              Plan vs. Ist ansehen, Standup generieren, Entfallenes auf morgen schieben.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={props.onOpenReview}>Tag abschließen →</button>
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
