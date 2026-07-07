import { projects, fmtHours } from '../data'

/** 7-Tage-Sparkline: Flächenfüllung + betonter Endpunkt. */
function Spark({ data, slot }: { data: number[]; slot: number }) {
  const W = 96, H = 30, max = Math.max(...data, 1)
  const pts = data.map((v, i) => [4 + (i * (W - 8)) / (data.length - 1), H - 4 - (v / max) * (H - 10)] as const)
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${H - 2} L ${pts[0][0].toFixed(1)} ${H - 2} Z`
  const [ex, ey] = pts[pts.length - 1]
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Verlauf letzte 7 Arbeitstage">
      <path d={area} fill={`var(--proj-${slot})`} opacity="0.15" />
      <path d={line} fill="none" stroke={`var(--proj-${slot})`} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="2.6" fill={`var(--proj-${slot})`} />
    </svg>
  )
}

export function Projects() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Projekte</h1>
        <span className="page-sub">5 aktiv · Monatssicht</span>
      </div>
      <div className="proj-list">
        {projects.map(p => (
          <div key={p.id} className="card proj-row">
            <span className="dot" style={{ background: `var(--proj-${p.slot})`, width: 10, height: 10 }} />
            <div style={{ minWidth: 0 }}>
              <div className="proj-name">{p.name}</div>
              <div className="proj-client">{p.client}</div>
            </div>
            <div className="proj-kpi">
              <div className="k">{fmtHours(p.hoursMonth)} h</div>
              <div className="kl">diesen Monat</div>
            </div>
            <div className="proj-kpi">
              <div className="k">{p.rate > 0 ? `${p.rate} €/h` : '—'}</div>
              <div className="kl">{p.budgetPct > 0 ? `Budget ${p.budgetPct} %` : 'ohne Budget'}</div>
            </div>
            <Spark data={p.trend} slot={p.slot} />
          </div>
        ))}
      </div>
    </>
  )
}
