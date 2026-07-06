import { useState } from 'react'
import { projects, weekHours, heat, fmtHours } from '../data'

/** Budget-Ring (SVG): Verbrauch auf einen Blick, Warnstufen ab 80/100 %. */
function Ring({ pct, slot, size = 76 }: { pct: number; slot: number; size?: number }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const filled = Math.min(pct, 100) / 100
  const state = pct >= 100 ? 'var(--crit)' : pct >= 80 ? 'var(--accent)' : `var(--proj-${slot})`
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Budget ${pct} % verbraucht`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={state} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${c * filled} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
        style={{ font: '700 15px var(--font-num)', fill: 'var(--ink)' }}>
        {pct}%
      </text>
    </svg>
  )
}

/** Überstunden-Saldo als Gauge: neutraler Bogen, Füllung von 0 zum Wert. */
function OvertimeGauge({ hours, min = -10, max = 10 }: { hours: number; min?: number; max?: number }) {
  const W = 220, H = 120, cx = W / 2, cy = H - 10, R = 88
  const angle = (v: number) => Math.PI * (1 - (v - min) / (max - min))
  const arc = (a1: number, a2: number, radius: number) => {
    const x1 = cx + radius * Math.cos(a1), y1 = cy - radius * Math.sin(a1)
    const x2 = cx + radius * Math.cos(a2), y2 = cy - radius * Math.sin(a2)
    const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} ${a1 > a2 ? 1 : 0} ${x2} ${y2}`
  }
  const zero = angle(0)
  const val = angle(Math.max(min, Math.min(max, hours)))
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Überstundensaldo ${fmtHours(Math.abs(hours))} ${hours >= 0 ? 'plus' : 'minus'}`}>
      <path d={arc(Math.PI, 0, R)} fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />
      <path d={arc(zero, val, R)} fill="none" stroke={hours >= 0 ? 'var(--accent)' : 'var(--crit)'} strokeWidth="10" strokeLinecap="round" />
      <line x1={cx + (R - 14) * Math.cos(zero)} y1={cy - (R - 14) * Math.sin(zero)} x2={cx + (R + 8) * Math.cos(zero)} y2={cy - (R + 8) * Math.sin(zero)} stroke="var(--ink-3)" strokeWidth="1.5" />
      <text x={cx} y={cy - 26} textAnchor="middle" style={{ font: '700 24px var(--font-num)', fill: 'var(--ink)' }}>
        {hours >= 0 ? '+' : '−'}{fmtHours(Math.abs(hours))}
      </text>
      <text x={cx} y={cy - 6} textAnchor="middle" style={{ font: '500 11px var(--font-ui)', fill: 'var(--ink-3)' }}>
        Überstunden-Saldo
      </text>
      <text x={cx - R} y={cy + 8} textAnchor="middle" style={{ font: '10px var(--font-num)', fill: 'var(--ink-3)' }}>{min}h</text>
      <text x={cx + R} y={cy + 8} textAnchor="middle" style={{ font: '10px var(--font-num)', fill: 'var(--ink-3)' }}>+{max}h</text>
    </svg>
  )
}

export function Reports() {
  const [hover, setHover] = useState<number | null>(null)
  const maxDay = Math.max(...weekHours.map(d => d.billable + d.rest), 8)
  const weekTotal = weekHours.reduce((s, d) => s + d.billable + d.rest, 0)
  const billTotal = weekHours.reduce((s, d) => s + d.billable, 0)
  const billPct = Math.round((billTotal / weekTotal) * 100)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Berichte</h1>
        <span className="page-sub">Diese Woche · alle Werte aus dem deterministischen Kern</span>
      </div>

      <div className="stat-row">
        <div className="card card-pad stat-tile">
          <div className="s-label">Woche bisher</div>
          <div className="s-value num">{fmtHours(weekTotal)} h</div>
          <div className="s-sub">Soll bis heute: 32:00 h</div>
        </div>
        <div className="card card-pad stat-tile">
          <div className="s-label">Abrechenbar</div>
          <div className="s-value num">{billPct} %</div>
          <div className="s-sub num">{fmtHours(billTotal)} h · ≈ 2.140 €</div>
        </div>
        <div className="card card-pad stat-tile">
          <div className="s-label">Urlaub übrig</div>
          <div className="s-value num">17 Tage</div>
          <div className="s-sub">3 genommen · 2 krank dieses Jahr</div>
        </div>
        <div className="card card-pad stat-tile" style={{ display: 'grid', placeItems: 'center' }}>
          <OvertimeGauge hours={3.33} />
        </div>
      </div>

      <div className="report-grid">
        <section className="card card-pad" aria-label="Stunden pro Tag">
          <div className="card-title">Stunden pro Tag</div>
          <div className="bars">
            {weekHours.map((d, i) => {
              const total = d.billable + d.rest
              return (
                <div
                  key={d.day}
                  className={`bar-col ${i === 3 ? 'today' : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  title={total > 0 ? `${d.day}: ${fmtHours(d.billable)} h abrechenbar, ${fmtHours(d.rest)} h intern` : `${d.day}: —`}
                >
                  <span className="b-val">{hover === i && total > 0 ? `${fmtHours(total)}` : total > 0 ? fmtHours(total) : ''}</span>
                  <div className="bar-stack" style={{ height: `${(total / maxDay) * 100}%` }}>
                    {d.billable > 0 && <div className="bar-seg" style={{ flex: d.billable, background: 'var(--proj-1)' }} />}
                    {d.rest > 0 && <div className="bar-seg rest" style={{ flex: d.rest, background: 'color-mix(in srgb, var(--proj-1) 35%, var(--surface))' }} />}
                  </div>
                  <span className="b-day">{d.day}</span>
                </div>
              )
            })}
          </div>
          <div className="legend">
            <span className="lg"><span className="sw" style={{ background: 'var(--proj-1)' }} /> abrechenbar</span>
            <span className="lg"><span className="sw" style={{ background: 'color-mix(in srgb, var(--proj-1) 35%, var(--surface))' }} /> intern</span>
          </div>
        </section>

        <section className="card card-pad" aria-label="Projektbudgets">
          <div className="card-title">Projektbudgets</div>
          <div className="rings">
            {projects.filter(p => p.budgetPct > 0).map(p => (
              <div key={p.id} className="ring-item">
                <Ring pct={p.budgetPct} slot={p.slot} />
                <span className="rname">{p.name}</span>
                {p.budgetPct >= 80 && <span className="chip warn">Budget-Warnung</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad" style={{ gridColumn: '1 / -1' }} aria-label="Intensität der letzten 12 Wochen">
          <div className="card-title">Intensität · 12 Wochen (Mo–Fr)</div>
          <div className="heatwrap">
            <div className="heatgrid">
              {heat.map((week, wi) => (
                <div key={wi} className="heatcol">
                  {week.map((v, di) => (
                    <div
                      key={di}
                      className="heatcell"
                      style={{ ['--v' as string]: v }}
                      title={`KW ${16 + wi} · ${['Mo', 'Di', 'Mi', 'Do', 'Fr'][di]}: ${fmtHours(v * 8)} h`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="heat-axis"><span>KW 16</span><span>KW 21</span><span>KW 27</span></div>
          </div>
        </section>
      </div>
    </>
  )
}
