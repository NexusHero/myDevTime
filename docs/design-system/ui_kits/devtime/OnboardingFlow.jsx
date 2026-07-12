/* First-run onboarding — the moment users decide to stay.
   Flow: Welcome (logo sting) → Arbeitszeit → Projekte → Auto-Tracker → Fertig.
   Principles: bounded (no scroll), one decision per step, every step skippable,
   privacy stated where data is touched (ux-vision §5: trust is the aesthetic). */
function OnboardingFlow() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Button, Icon } = DS;
  const [step, setStep] = React.useState(0);

  // Step 1 — Arbeitszeit (minutes/day)
  const [daily, setDaily] = React.useState(504); // 8:24 = 42h-Woche
  const [autoBreak, setAutoBreak] = React.useState(true);
  const fmtHM = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

  // Step 2 — Projekte
  const COLORS = ['var(--project-1)', 'var(--project-2)', 'var(--project-3)', 'var(--project-4)', 'var(--project-5)'];
  const [projects, setProjects] = React.useState([]);
  const [pName, setPName] = React.useState('');
  const [pColor, setPColor] = React.useState(0);
  const [imported, setImported] = React.useState(null);
  const addProject = () => {
    if (!pName.trim()) return;
    setProjects((ps) => [...ps, { name: pName.trim(), color: COLORS[pColor] }]);
    setPName('');
    setPColor((c) => (c + 1) % COLORS.length);
  };

  // Step 3 — Auto-Tracker
  const [tracker, setTracker] = React.useState(null); // true | false | null

  const steps = ['Willkommen', 'Arbeitszeit', 'Projekte', 'Auto-Tracker', 'Fertig'];
  const last = steps.length - 1;

  const shellStyle = {
    height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    background: step === 0
      ? 'radial-gradient(120% 120% at 50% 0%, #16255c 0%, #0d1330 55%, #0a0c11 100%)'
      : 'var(--bg)',
    fontFamily: 'var(--font-ui)', color: 'var(--ink)',
    transition: 'background 400ms var(--ease-out)',
  };

  const Dots = () => (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: '18px 0' }}>
      {steps.map((s, i) => (
        <span key={s} title={s} style={{
          width: i === step ? 22 : 7, height: 7, borderRadius: 999,
          background: i === step ? 'var(--live)' : (step === 0 ? 'rgba(255,255,255,0.25)' : 'var(--border-strong)'),
          transition: 'width var(--dur-med) var(--ease-spring), background var(--dur-med) var(--ease-out)',
        }}></span>
      ))}
    </div>
  );

  const NavRow = ({ nextLabel = 'Weiter', nextDisabled = false, onNext, skip = true }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 28 }}>
      <button onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '10px 6px' }}>Zurück</button>
      <span style={{ flex: 1 }}></span>
      {skip && <button onClick={() => setStep((s) => Math.min(last, s + 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)', fontWeight: 600, padding: '10px 6px' }}>Überspringen</button>}
      <Button onClick={onNext || (() => setStep((s) => Math.min(last, s + 1)))} disabled={nextDisabled}>{nextLabel}</Button>
    </div>
  );

  const card = {
    width: 'min(560px, calc(100vw - 48px))', margin: '0 auto',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)',
    padding: '32px 34px', boxSizing: 'border-box',
    animation: 'ob-rise 380ms var(--ease-spring) both',
  };
  const h1 = { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-xl)', letterSpacing: 'var(--ls-tight)', margin: 0 };
  const sub = { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', lineHeight: 'var(--lh-normal)', margin: '6px 0 24px' };

  return (
    <div style={shellStyle}>
      <style>{`
        @keyframes ob-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ob-tile { 0% { transform: scale(0.55); opacity: 0; } 55% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ob-sweep { 0%, 25% { transform: scaleY(0); } 60%, 100% { transform: scaleY(1); } }
        @keyframes ob-pulse { 0%, 45% { transform: scale(0); } 62% { transform: scale(1.35); } 75%, 100% { transform: scale(1); } }
        @keyframes ob-slide { 0%, 35% { transform: translateX(-16px); opacity: 0; } 65%, 100% { transform: translateX(0); opacity: 1; } }
        @keyframes ob-fade { 0%, 55% { opacity: 0; } 85%, 100% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>

      {step > 0 && <Dots />}

      {/* ── 0 · WELCOME — the logo sting, playhead first ── */}
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
          <div style={{ position: 'relative', width: 118, height: 118, borderRadius: 28, background: 'linear-gradient(135deg, #3D5CF5 0%, #2941B8 100%)', boxShadow: '0 24px 60px -18px rgba(61,92,245,0.55)', animation: 'ob-tile 700ms var(--ease-spring) both' }}>
            <span style={{ position: 'absolute', left: 23, top: 44, width: 28, height: 33, borderRadius: 8, background: '#fff', animation: 'ob-slide 1300ms var(--ease-spring) both' }}></span>
            <span style={{ position: 'absolute', left: 67, top: 44, width: 28, height: 33, borderRadius: 8, border: '3px dashed rgba(255,255,255,0.8)', boxSizing: 'border-box', animation: 'ob-fade 1600ms ease both' }}></span>
            <span style={{ position: 'absolute', left: 56.5, top: 37, width: 5, height: 48, borderRadius: 3, background: 'var(--live)', transformOrigin: 'top center', animation: 'ob-sweep 1100ms var(--ease-out) both' }}></span>
            <span style={{ position: 'absolute', left: 53, top: 23, width: 12, height: 12, borderRadius: '50%', background: 'var(--live)', animation: 'ob-pulse 1500ms ease both' }}></span>
          </div>
          <div style={{ textAlign: 'center', animation: 'ob-rise 500ms 600ms var(--ease-out) both' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 34, letterSpacing: '-0.02em', color: '#fff' }}>my<span style={{ color: 'var(--live)' }}>Dev</span>Time</div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>Dein Tag, geplant. Plan und Realität auf einer Fläche.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'ob-rise 500ms 900ms var(--ease-out) both' }}>
            <Button size="lg" onClick={() => setStep(1)}>Los geht's</Button>
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Ich habe schon ein Konto</button>
          </div>
        </div>
      )}

      {/* ── 1 · ARBEITSZEIT ── */}
      {step === 1 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={card}>
            <h1 style={h1}>Deine tägliche Sollzeit</h1>
            <p style={sub}>Daraus rechnet myDevTime Überstunden, Drift und deine Balance. Später jederzeit im Profil änderbar — auch pro Wochentag.</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 18 }}>
              <button onClick={() => setDaily((d) => Math.max(240, d - 5))} aria-label="5 Minuten weniger" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', fontSize: 20, color: 'var(--ink-2)' }}>−</button>
              <div style={{ textAlign: 'center', minWidth: 150 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 46, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', lineHeight: 1 }}>{fmtHM(daily)}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 6 }}>Stunden pro Tag</div>
              </div>
              <button onClick={() => setDaily((d) => Math.min(720, d + 5))} aria-label="5 Minuten mehr" style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', fontSize: 20, color: 'var(--ink-2)' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {[456, 480, 504].map((m) => (
                <button key={m} onClick={() => setDaily(m)} style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                  border: daily === m ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: daily === m ? 'var(--accent-soft)' : 'var(--surface)',
                  color: daily === m ? 'var(--accent-strong)' : 'var(--ink-2)',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                }}>{fmtHM(m)}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>Woche (×5)</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtHM(daily * 5)} h</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoBreak} onChange={(e) => setAutoBreak(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>Gesetzliche Pausen automatisch abziehen (30 min ab 6 h)</span>
            </label>
            <NavRow skip={false} />
          </div>
        </div>
      )}

      {/* ── 2 · PROJEKTE ── */}
      {step === 2 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={card}>
            <h1 style={h1}>Woran arbeitest du?</h1>
            <p style={sub}>Leg dein erstes Projekt an — oder bring deine Historie mit. Farben kommen aus der festen Projekt-Palette.</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProject()}
                placeholder="Projektname, z. B. Finanzo AG"
                style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--fs-sm)', outline: 'none', fontFamily: 'var(--font-ui)' }}
              />
              <Button onClick={addProject} disabled={!pName.trim()}>Anlegen</Button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {COLORS.map((c, i) => (
                <button key={c} onClick={() => setPColor(i)} aria-label={'Farbe ' + (i + 1)} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: pColor === i ? '2.5px solid var(--ink)' : '2.5px solid transparent', cursor: 'pointer', boxSizing: 'border-box' }}></button>
              ))}
            </div>
            {projects.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, maxHeight: 130, overflow: 'auto' }}>
                {projects.map((p) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <span style={{ width: 26, height: 26, borderRadius: 8, background: 'color-mix(in srgb, ' + p.color + ' 16%, var(--surface))', color: p.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12 }}>{p.name.slice(0, 2).toUpperCase()}</span>
                    <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: 'var(--ls-wide)', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 10 }}>Oder importieren</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Toggl', 'Clockify', 'CSV'].map((src) => (
                  <button key={src} onClick={() => { setImported(src); setProjects((ps) => ps.length ? ps : [{ name: 'Finanzo AG', color: COLORS[0] }, { name: 'Sync engine', color: COLORS[1] }, { name: 'Nordwind GmbH', color: COLORS[2] }]); }} style={{
                    padding: '8px 16px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600,
                    border: imported === src ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
                    background: imported === src ? 'var(--accent-soft)' : 'var(--surface)',
                    color: imported === src ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{imported === src ? '✓ ' + src : src}</button>
                ))}
              </div>
              {imported && <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--good)', marginTop: 10 }}>3 Projekte aus {imported} importiert — Zeiten folgen im Hintergrund.</div>}
            </div>
            <NavRow nextDisabled={false} />
          </div>
        </div>
      )}

      {/* ── 3 · AUTO-TRACKER ── */}
      {step === 3 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={card}>
            <h1 style={h1}>Auto-Tracker aktivieren?</h1>
            <p style={sub}>Während ein Timer läuft, kann myDevTime lokal aufzeichnen, welche Apps du wie lange nutzt — dein Tag füllt sich von selbst.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--live-border)', background: 'var(--live-soft)', marginBottom: 16 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--live)', flexShrink: 0, boxShadow: '0 0 0 5px color-mix(in srgb, var(--live) 18%, transparent)' }}></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>VS Code · 1h 36m</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>So sieht ein aufgezeichneter Eintrag aus.</div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--live)', letterSpacing: 'var(--ls-wide)' }}>REC</span>
            </div>
            <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
              {['Bleibt zu 100 % auf diesem Gerät — nichts geht in die Cloud', 'Einzelne Apps jederzeit ausschließbar', 'Läuft nur, während du trackst — nie im Hintergrund'].map((t) => (
                <li key={t} style={{ display: 'flex', gap: 9, alignItems: 'baseline', fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--good)', fontWeight: 700 }}>✓</span>{t}
                </li>
              ))}
            </ul>
            <NavRow nextLabel={tracker === false ? 'Weiter' : 'Aktivieren & weiter'} onNext={() => { if (tracker === null) setTracker(true); setStep(4); }} skip={false} />
            <button onClick={() => { setTracker(false); setStep(4); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)', fontWeight: 600, marginTop: 6, padding: 6 }}>Jetzt nicht — später im Profil</button>
          </div>
        </div>
      )}

      {/* ── 4 · FERTIG ── */}
      {step === 4 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--good-soft, var(--accent-soft))', color: 'var(--good)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 14 }}>✓</div>
            <h1 style={h1}>Alles bereit.</h1>
            <p style={{ ...sub, marginBottom: 20 }}>Dein erster Tag ist noch leer — genau richtig. Starte den Timer, wenn du loslegst, oder lass den Co-Planner einen Vorschlag machen.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 24 }}>
              {[
                ['Sollzeit', fmtHM(daily) + ' h/Tag · ' + fmtHM(daily * 5) + ' h/Woche'],
                ['Projekte', projects.length > 0 ? projects.length + ' angelegt' : 'noch keine — geht auch später'],
                ['Auto-Tracker', tracker ? 'aktiv (lokal)' : 'aus'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)' }}>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>{k}</span>
                  <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button size="lg" onClick={() => { window.location.href = 'index.html'; }}>Zum Workspace</Button>
            </div>
            <button onClick={() => setStep(0)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 'var(--fs-2xs)', fontWeight: 600, marginTop: 14, padding: 6 }}>Demo neu starten</button>
          </div>
        </div>
      )}
    </div>
  );
}
window.OnboardingFlow = OnboardingFlow;
