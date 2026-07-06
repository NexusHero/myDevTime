import { useState } from 'react'
import { Icon } from '../components/Icon'
import { meetings, projectById } from '../data'

export function Meetings({ onToast }: { onToast: (msg: string) => void }) {
  const [selId, setSelId] = useState('m1')
  const sel = meetings.find(m => m.id === selId)!
  const proj = projectById(sel.project)

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Meetings</h1>
        <span className="page-sub">Transkripte & AI-Insights · Consent-first</span>
      </div>

      <div className="meet-grid">
        <section className="card card-pad" aria-label="Meeting-Liste">
          <div className="card-title">Diese Woche</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {meetings.map(m => {
              const p = projectById(m.project)!
              return (
                <button key={m.id} className={`meet-item ${m.id === selId ? 'sel' : ''}`} onClick={() => setSelId(m.id)}>
                  <span className="meet-title">
                    <span className="dot" style={{ background: `var(--proj-${p.slot})` }} />
                    {m.title}
                  </span>
                  <span className="meet-meta">
                    <span className="num">{m.time}</span> · {m.duration}
                    {m.state === 'insights' && <span className="chip good">Insights ✓</span>}
                    {m.state === 'transcript' && <span className="chip">Transkript</span>}
                    {m.state === 'upcoming' && <span className="chip warn">Aufnahme zugestimmt</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card card-pad" aria-label="Meeting-Details">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.02em' }}>{sel.title}</h2>
              <span className="meet-meta"><span className="num">{sel.time}</span> · {sel.duration} · {proj?.name}</span>
            </div>
            {sel.state !== 'upcoming' && <span className="chip good">Transkript · de</span>}
          </div>

          {sel.state === 'insights' && (
            <>
              <div className="card-title" style={{ marginTop: 'var(--sp-4)' }}>Zusammenfassung <span className="chip ai" style={{ marginLeft: 6 }}>KI · 1 Credit</span></div>
              <ul className="insight-list">
                {sel.summary!.map((s, i) => <li key={i}>{s}</li>)}
              </ul>

              <div className="card-title" style={{ marginTop: 'var(--sp-5)' }}>Action Items</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sel.actions!.map((a, i) => (
                  <div key={i} className="action-row">
                    <span>{a}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => onToast('Als Task angelegt — nach Bestätigung, nie automatisch.')}>
                      → Task erstellen
                    </button>
                  </div>
                ))}
              </div>

              <div className="card-title" style={{ marginTop: 'var(--sp-5)' }}>Eigene Prompts</div>
              <div className="prompt-chips">
                {['Follow-up-Mail entwerfen', 'Scope-Änderungen extrahieren', 'Entscheidungen auflisten'].map(p => (
                  <button key={p} className="chip" onClick={() => onToast(`Prompt „${p}“ würde 1 AI-Credit kosten.`)}>
                    <Icon name="sparkle" size={12} /> {p}
                  </button>
                ))}
              </div>
              <div className="credit-note">
                <Icon name="doc" size={12} /> Jede Zahl im Text stammt aus dem deterministischen Kern (Slot-Integrität) ·
                Transkript zählt zu deinen Daten: Export & Löschung inklusive
              </div>
            </>
          )}

          {sel.state === 'transcript' && (
            <p style={{ marginTop: 'var(--sp-4)', color: 'var(--ink-2)' }}>
              Transkript vorhanden — noch keine Insights erzeugt.
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 12 }} onClick={() => onToast('Zusammenfassung würde 1 AI-Credit kosten (Demo).')}>
                <Icon name="sparkle" size={13} /> Zusammenfassen · 1 Credit
              </button>
            </p>
          )}

          {sel.state === 'upcoming' && (
            <p style={{ marginTop: 'var(--sp-4)', color: 'var(--ink-2)' }}>
              Beginnt um 15:00. Aufnahme-Einwilligung ist erteilt (pro Meeting widerrufbar) — der Bot tritt sichtbar bei,
              alle Teilnehmenden sehen den Aufnahme-Status.
            </p>
          )}
        </section>
      </div>
    </>
  )
}
