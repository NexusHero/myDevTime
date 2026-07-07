import { useState } from 'react'
import { absences, allowance, creditBalance, ledger, rules, TODAY_DATE, type AbsenceKind } from '../data'

/** Juli 2026 — 1.7. ist ein Mittwoch; Monatsraster Mo–So. */
function AbsenceCalendar() {
  const firstWeekday = 2 // 0=Mo … 2=Mi
  const daysInMonth = 31
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const kindClass = (k?: AbsenceKind) =>
    k === 'vacation' ? 'cal-vac' : k === 'sick' ? 'cal-sick' : k === 'holiday' ? 'cal-hol' : ''

  return (
    <>
      <div className="cal-head">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="cal-grid" role="grid" aria-label="Abwesenheiten Juli 2026">
        {cells.map((d, i) => {
          const weekend = i % 7 >= 5
          return (
            <div
              key={i}
              className={`cal-cell ${d ? '' : 'empty'} ${weekend ? 'weekend' : ''} ${d ? kindClass(absences[d]) : ''} ${d === TODAY_DATE ? 'today' : ''}`}
              title={d && absences[d] ? { vacation: 'Urlaub', sick: 'Krank', holiday: 'Feiertag' }[absences[d]] : undefined}
            >
              {d ?? ''}
            </div>
          )
        })}
      </div>
      <div className="legend" style={{ marginTop: 'var(--sp-3)' }}>
        <span className="lg"><span className="sw" style={{ background: 'var(--good)' }} /> Urlaub</span>
        <span className="lg"><span className="sw" style={{ background: 'var(--crit)' }} /> Krank</span>
        <span className="lg"><span className="sw" style={{ background: 'var(--accent)' }} /> heute</span>
      </div>
    </>
  )
}

export function Profile({ onToast }: { onToast: (msg: string) => void }) {
  const [ruleState, setRuleState] = useState(rules.map(r => r.enabled))
  const [msConnected, setMsConnected] = useState(false)
  const [mirror, setMirror] = useState(false)
  const remaining = allowance.entitled - allowance.taken - allowance.planned

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Profil</h1>
        <span className="page-sub">Suhay · Pro-Plan · Workspace „Freelance“</span>
      </div>

      <div className="profile-grid">
        <section className="card card-pad" aria-label="Abwesenheiten">
          <div className="card-title">Abwesenheiten · Juli 2026</div>
          <AbsenceCalendar />
          <div className="summary-list" style={{ marginTop: 'var(--sp-4)' }}>
            <div className="summary-item"><span className="lbl">Urlaubsanspruch</span><span className="val num">{allowance.entitled} Tage</span></div>
            <div className="summary-item"><span className="lbl">Genommen · geplant</span><span className="val num">{allowance.taken} · {allowance.planned}</span></div>
            <div className="summary-item"><span className="lbl">Übrig</span><span className="val"><span className="chip good">{remaining} Tage</span></span></div>
            <div className="summary-item"><span className="lbl">Krankheitstage {`(${new Date().getFullYear() === 2026 ? '2026' : '2026'})`}</span><span className="val num">{allowance.sick}</span></div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--sp-3)' }} onClick={() => onToast('Abwesenheit eintragen — ≤3 Taps, im Prototyp gemockt')}>
            + Abwesenheit eintragen
          </button>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <section className="card card-pad" aria-label="AI-Credits">
            <div className="card-title">AI-Credits</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span className="s-value num" style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>{creditBalance}</span>
              <span style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-sm)' }}>Credits übrig · 1 Credit = 1 KI-Aktion</span>
            </div>
            <div className="ledger">
              {ledger.map((e, i) => (
                <div key={i} className="ledger-row">
                  <span className="ll">{e.label}<span className="lw">{e.when}</span></span>
                  <span className={`num ld ${e.delta > 0 ? 'plus' : ''}`}>{e.delta > 0 ? `+${e.delta}` : e.delta}</span>
                </div>
              ))}
            </div>
            <div className="briefing-row" style={{ marginTop: 'var(--sp-3)' }}>
              <button className="btn btn-primary btn-sm" onClick={() => onToast('Top-up via Stripe/IAP — Demo')}>+50 Credits · 4,99 €</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onToast('Top-up via Stripe/IAP — Demo')}>+200 · 14,99 €</button>
            </div>
          </section>

          <section className="card card-pad" aria-label="Abo">
            <div className="card-title">Abo</div>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Pro</strong> · 9,99 €/Monat · via Web (Stripe)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onToast('Öffnet das Stripe-Kundenportal — Demo')}>Verwalten</button>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', marginTop: 8 }}>
              100 Credits/Monat inklusive · deterministische Funktionen kosten nie Credits
            </p>
          </section>
        </div>

        <section className="card card-pad" aria-label="Automatisierungs-Regeln">
          <div className="card-title">Regeln · deterministisch, versioniert</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rules.map((r, i) => (
              <div key={r.id} className="rule-row">
                <button
                  className={`switch ${ruleState[i] ? 'on' : ''}`}
                  role="switch" aria-checked={ruleState[i]} aria-label={`Regel ${r.name}`}
                  onClick={() => setRuleState(s => s.map((v, j) => (j === i ? !v : v)))}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {r.name}
                    {r.auto && <span className="chip">Auto-Bestätigen</span>}
                    <span className="chip" title="Dry-Run über den letzten Monat">~{r.hits}×/Monat</span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>{r.cond} <span style={{ color: 'var(--ink-3)' }}>{r.action}</span></div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--sp-3)' }} onClick={() => onToast('Regel-Builder mit Dry-Run-Vorschau — Web-Ansicht, Demo')}>
            + Neue Regel
          </button>
        </section>

        <section className="card card-pad" aria-label="Integrationen">
          <div className="card-title">Integrationen & Einwilligungen</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Google Kalender</strong> · verbunden · 2 Kalender<br />
                <span style={{ fontSize: 'var(--fs-xs)' }}>Lesezugriff · Token verschlüsselt · jederzeit widerrufbar</span></span>
              <span className="chip good">aktiv</span>
            </div>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Microsoft 365</strong> · nicht verbunden</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setMsConnected(true); onToast('OAuth-Flow — Demo') }}>{msConnected ? 'verbunden ✓' : 'Verbinden'}</button>
            </div>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Meeting-Aufnahme</strong> · Einwilligung pro Meeting<br />
                <span style={{ fontSize: 'var(--fs-xs)' }}>Consent-first: keine Aufnahme ohne gespeichertes Opt-in · Bot sichtbar</span></span>
              <span className="chip warn">pro Meeting</span>
            </div>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Ist-Blöcke in Kalender spiegeln</strong><br />
                <span style={{ fontSize: 'var(--fs-xs)' }}>Eigener Kalender „myDevTime Ist“ · Detailgrad wählbar · Schreibrecht erst bei Aktivierung</span></span>
              <button
                className={`switch ${mirror ? 'on' : ''}`}
                role="switch" aria-checked={mirror} aria-label="Kalender-Spiegelung"
                onClick={() => { setMirror(m => !m); onToast(mirror ? 'Spiegelung aus — Aufräumen des Ist-Kalenders angeboten' : 'Schreibrecht angefragt, Kalender „myDevTime Ist“ wird angelegt (Demo)') }}
              />
            </div>
            <div className="summary-item">
              <span className="lbl"><strong style={{ color: 'var(--ink)' }}>Jira · Linear · Slack</strong> · Insight-Export<br />
                <span style={{ fontSize: 'var(--fs-xs)' }}>Action Items & Zusammenfassungen dorthin senden, wo gearbeitet wird — immer mit Vorschau</span></span>
              <button className="btn btn-ghost btn-sm" onClick={() => onToast('OAuth pro Ziel, minimale Scopes — Demo')}>Verbinden</button>
            </div>
          </div>
        </section>

        <section className="card card-pad" aria-label="Arbeitszeit-Schema">
          <div className="card-title">Arbeitszeit-Schema · gültig ab 1.7.2026</div>
          <div className="schedule-row">
            {[['Mo', '8:00'], ['Di', '8:00'], ['Mi', '8:00'], ['Do', '8:00'], ['Fr', '6:00'], ['Sa', '—'], ['So', '—']].map(([d, v]) => (
              <div key={d} className="sched-cell">
                <span className="sd">{d}</span>
                <span className={`num sv ${v === '—' ? 'off' : ''}`}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', marginTop: 10 }}>
            Änderungen gelten ab Datum (effective-dated) — vergangene Tage werden nie umgerechnet.
            Wochensoll: <span className="num">38:00 h</span> · Pausenregel-Preset: ArbZG §4
          </p>
        </section>
      </div>
    </>
  )
}
