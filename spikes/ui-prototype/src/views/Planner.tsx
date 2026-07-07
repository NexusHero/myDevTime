import { fmtHours, type ProjectId } from '../data'

interface Mini { day: number; start: number; len: number; slot: number; t: string; ghost?: boolean; project?: ProjectId }

// Wochenansicht 08–18 Uhr, Mo–Fr; Freitag = Urlaub (Abwesenheits-Overlay)
const SPAN = 10 * 60
const mini: Mini[] = [
  { day: 0, start: 40, len: 90, slot: 1, t: 'Sync-Engine' }, { day: 0, start: 150, len: 60, slot: 2, t: 'Finanzo API' }, { day: 0, start: 260, len: 120, slot: 1, t: 'Reviews' }, { day: 0, start: 420, len: 90, slot: 3, t: 'Huber CMS' },
  { day: 1, start: 30, len: 120, slot: 1, t: 'Timer-Modul' }, { day: 1, start: 180, len: 45, slot: 4, t: 'CI-Fix' }, { day: 1, start: 260, len: 150, slot: 2, t: 'Finanzo Auth' },
  { day: 2, start: 60, len: 60, slot: 3, t: 'Huber Call' }, { day: 2, start: 140, len: 120, slot: 1, t: 'Canvas-UI' }, { day: 2, start: 300, len: 90, slot: 2, t: 'Finanzo Doku' }, { day: 2, start: 430, len: 60, slot: 5, t: 'OSS-PR' },
  { day: 3, start: 8, len: 48, slot: 1, t: 'Review #218' }, { day: 3, start: 78, len: 90, slot: 1, t: 'Konflikt-Tests' }, { day: 3, start: 190, len: 40, slot: 3, t: 'Angebot' }, { day: 3, start: 273, len: 65, slot: 1, ghost: true, t: 'Tombstones' }, { day: 3, start: 420, len: 60, slot: 2, t: 'Sprint-Review' }, { day: 3, start: 490, len: 50, slot: 2, ghost: true, t: 'Doku REQ-025' },
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
                      title={m.ghost ? `${m.t} · Co-Planer-Vorschlag` : m.t}
                    >
                      <span className="mb-label">{m.t}</span>
                    </div>
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
