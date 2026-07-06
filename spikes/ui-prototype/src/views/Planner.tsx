import { fmtHours, type ProjectId } from '../data'

interface Mini { day: number; start: number; len: number; slot: number; ghost?: boolean; project?: ProjectId }

// Wochenansicht 08–18 Uhr, Mo–Fr; Freitag = Urlaub (Abwesenheits-Overlay)
const SPAN = 10 * 60
const mini: Mini[] = [
  { day: 0, start: 40, len: 90, slot: 1 }, { day: 0, start: 150, len: 60, slot: 2 }, { day: 0, start: 260, len: 120, slot: 1 }, { day: 0, start: 420, len: 90, slot: 3 },
  { day: 1, start: 30, len: 120, slot: 1 }, { day: 1, start: 180, len: 45, slot: 4 }, { day: 1, start: 260, len: 150, slot: 2 },
  { day: 2, start: 60, len: 60, slot: 3 }, { day: 2, start: 140, len: 120, slot: 1 }, { day: 2, start: 300, len: 90, slot: 2 }, { day: 2, start: 430, len: 60, slot: 5 },
  { day: 3, start: 8, len: 48, slot: 1 }, { day: 3, start: 78, len: 90, slot: 1 }, { day: 3, start: 190, len: 40, slot: 3 }, { day: 3, start: 273, len: 65, slot: 1, ghost: true }, { day: 3, start: 420, len: 60, slot: 2 }, { day: 3, start: 490, len: 50, slot: 2, ghost: true },
]

const dayHours = [7.5, 7.9, 7.2, 6.4]

export function Planner() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Planer</h1>
        <span className="page-sub">KW 27 · Plan (gestrichelt) und Ist auf einer Fläche</span>
      </div>
      <div className="week-scroll">
        <div className="week">
          {['Mo 6.7.', 'Di 7.7.', 'Mi 8.7.', 'Do 9.7. · heute', 'Fr 10.7.'].map((label, di) => (
            <div key={label} className="card week-day">
              <div className="wd-head">
                <span className="wd-name" style={di === 3 ? { color: 'var(--accent-text)' } : undefined}>{label}</span>
                <span className="wd-sum num">{di < 4 ? `${fmtHours(dayHours[di])} h` : 'Urlaub'}</span>
              </div>
              <div className="wd-body">
                {di === 4 ? (
                  <div className="absence-overlay">Urlaub · ganztägig</div>
                ) : (
                  mini.filter(m => m.day === di).map((m, i) => (
                    <div
                      key={i}
                      className={`mini-block ${m.ghost ? 'ghosty' : ''}`}
                      style={{
                        top: `${(m.start / SPAN) * 100}%`,
                        height: `${(m.len / SPAN) * 100}%`,
                        ['--pc' as string]: `var(--proj-${m.slot})`,
                      }}
                      title={m.ghost ? 'Co-Planer-Vorschlag' : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p style={{ marginTop: 'var(--sp-4)', color: 'var(--ink-3)', fontSize: 'var(--fs-sm)' }}>
        Blöcke zwischen Tagen verschieben (Drag) folgt in der Interaktions-Spezifikation aus Issue #39 —
        gestrichelte Blöcke sind Co-Planer-Vorschläge, schraffiert-grün ist Abwesenheit.
      </p>
    </>
  )
}
