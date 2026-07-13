function PhoneApp() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { AppShell, Island, Card, Badge, BudgetRing, StatTile } = DS;
  const LoadMeter = DS.LoadMeter || (() => null);
  const LeaveBalance = DS.LeaveBalance || (() => null);
  const [tab, setTab] = React.useState('today');
  const [theme, setTheme] = React.useState('blueprint');
  const [mode, setMode] = React.useState('light');
  const [running, setRunning] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  // Punch-out mood: nur im Moment des Ausstempelns, kein stehendes Widget
  const [askMood, setAskMood] = React.useState(false);
  const [moodPicked, setMoodPicked] = React.useState(null);
  const [secs, setSecs] = React.useState(2531);
  const [expanded, setExpanded] = React.useState(false);
  const [ghostAccepted, setGhostAccepted] = React.useState(false);
  const [entriesOpen, setEntriesOpen] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [absenceOpen, setAbsenceOpen] = React.useState(false);
  const [driftEvent, setDriftEvent] = React.useState(true);
  const [replanned, setReplanned] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);
  const replan = () => {
    setPlanning(true);
    setTimeout(() => { setReplanned(true); setDriftEvent(false); setPlanning(false); }, 900);
  };
  React.useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);
  const fmt = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0')).join(':');

  // ---- Day Canvas geometry (08–18) ----
  const HOUR_H = 40, START = 8, END = 18;
  const NOW = 14.33;
  const canvasBlocks = [
    { s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting' },
    { s: 9.5, d: 1.5, l: 'Finanzo Review', c: 'var(--project-1)', k: 'actual' },
    replanned
      ? { s: 15, d: 0.75, l: 'Nordwind Call (verschoben)', c: 'var(--project-3)', k: 'ghost2' }
      : { s: 11.25, d: 0.75, l: 'Nordwind Call', c: 'var(--project-3)', k: 'meeting' },
    { s: 12, d: 0.5, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { s: 12.5, d: 1.83, l: 'Sync engine: conflict resolution', c: 'var(--project-2)', k: 'live' },
    replanned
      ? { s: 16, d: 0.75, l: 'Review backlog', c: 'var(--project-4)', k: 'ghost' }
      : { s: 15.25, d: 0.75, l: 'Review backlog', c: 'var(--project-4)', k: 'ghost' },
  ];
  const fmtT = (h) => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');

  const blockStyle = (b) => {
    const tiny = b.d < 0.5;
    const base = {
      position: 'absolute', left: 6, right: 6,
      top: (b.s - START) * HOUR_H + 1, height: b.d * HOUR_H - 3,
      borderRadius: tiny ? 5 : 'var(--radius-block)', padding: tiny ? 0 : '5px 9px', overflow: 'hidden', boxSizing: 'border-box',
      fontSize: 'var(--fs-2xs)', lineHeight: 1.25,
    };
    if (b.k === 'break') return { ...base, background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 5px, transparent 5px 10px)', border: '1px dashed var(--border-strong)', color: 'var(--ink-3)' };
    if (b.k === 'ghost2') return { ...base, border: '1.5px dashed ' + b.c, color: 'var(--ink-2)', background: 'var(--surface)', animation: 'dtp-ghost-in 0.5s var(--ease-spring)' };
    if (b.k === 'ghost') return { ...base, border: '1.5px dashed ' + b.c, color: 'var(--ink-2)', background: 'var(--surface)' };
    if (b.k === 'meeting') return { ...base, background: b.c, color: '#fff' };
    if (b.k === 'live') return { ...base, background: 'color-mix(in srgb, ' + b.c + ' 16%, var(--surface))', border: '1.5px solid var(--live-border)', color: 'var(--ink)', boxShadow: '0 4px 16px -6px rgba(255,83,32,0.35)' };
    return { ...base, background: 'color-mix(in srgb, ' + b.c + ' 14%, var(--surface))', borderLeft: '3px solid ' + b.c, color: 'var(--ink)' };
  };

  const today = (
    <div style={{ padding: 16, paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{'@keyframes dtp-ghost-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } } @keyframes dtp-think { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Today</div>
          <div style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-2xs)' }}>Di, 8. Juli</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--good-soft)', color: 'var(--good)', fontSize: 10, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }}></span> +6m
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--live-soft)', color: 'var(--live-strong)', fontSize: 10, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--live)' }}></span> 12
        </span>
      </div>

      {/* Hero timer — the heart, thumb-reachable */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: 'var(--surface)', borderRadius: 'var(--radius-xl)',
        border: running ? '1px solid var(--live-border)' : '1px solid var(--border)',
        boxShadow: running ? '0 10px 30px -12px rgba(255,83,32,0.4)' : 'var(--shadow-md)',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sync engine: conflict resolution</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--project-2)' }}></span>
            <span style={{ fontSize: 10, color: 'var(--ink-2)', fontWeight: 600 }}>Sync engine</span>
          </div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: running ? (paused ? 'var(--warn)' : 'var(--live)') : 'var(--ink-3)' }}>{fmt(secs)}</span>
        {running && (
          <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
            {paused && [0, 1].map((i) => <span key={i} className="dt-pulse" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--warn)', animation: 'dt-punch-wave 2s var(--ease-out) infinite', animationDelay: i * 1 + 's', pointerEvents: 'none' }}></span>)}
            <button onClick={() => setPaused(!paused)} aria-label={paused ? 'Weiter' : 'Pause'} className={paused ? 'dt-breathe-warn' : ''} style={{
            width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', flexShrink: 0, position: 'relative',
            border: '1.5px solid ' + (paused ? 'var(--warn)' : 'var(--border-strong)'),
            background: paused ? 'var(--warn-soft)' : 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            {paused
              ? <span style={{ width: 0, height: 0, marginLeft: 2, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid var(--warn)' }}></span>
              : <React.Fragment>
                  <span style={{ width: 4, height: 13, borderRadius: 2, background: 'var(--ink-2)' }}></span>
                  <span style={{ width: 4, height: 13, borderRadius: 2, background: 'var(--ink-2)' }}></span>
                </React.Fragment>}
            </button>
          </span>
        )}
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <style>{[
            '@keyframes dt-punch-wave { 0% { transform: scale(0.5); opacity: 0.45; } 100% { transform: scale(1.9); opacity: 0; } }',
            '@keyframes dt-breathe { 0%, 100% { transform: scale(1); box-shadow: 0 8px 20px -6px rgba(255,83,32,0.55); } 50% { transform: scale(1.06); box-shadow: 0 10px 28px -4px rgba(255,83,32,0.8); } }',
            '.dt-breathe-live { animation: dt-breathe 2.4s ease-in-out infinite; }',
            '@keyframes dt-breathe-w { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }',
            '.dt-breathe-warn { animation: dt-breathe-w 2s ease-in-out infinite; }',
            '@media (prefers-reduced-motion: reduce) { .dt-pulse, .dt-breathe-live, .dt-breathe-warn { animation: none !important; } .dt-pulse { opacity: 0 !important; } }',
          ].join(' ')}</style>
          {running && !paused && [0, 1].map((i) => (
            <span key={i} className="dt-pulse" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--live)', animation: 'dt-punch-wave 2.4s var(--ease-out) infinite', animationDelay: i * 1.2 + 's', pointerEvents: 'none' }}></span>
          ))}
          <button onClick={() => { if (running) { setRunning(false); setPaused(false); setAskMood(true); setMoodPicked(null); } else { setRunning(true); setAskMood(false); } }} aria-label={running ? 'Stop' : 'Start'} className={running && !paused ? 'dt-breathe-live' : ''} style={{
          width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative',
          background: running ? 'var(--live)' : 'var(--accent)',
          boxShadow: running ? '0 8px 20px -6px rgba(255,83,32,0.55)' : '0 8px 20px -6px rgba(37,99,235,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {running
            ? <span style={{ width: 16, height: 16, borderRadius: 4, background: '#fff' }}></span>
            : <span style={{ width: 0, height: 0, marginLeft: 4, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '17px solid #fff' }}></span>}
        </button>
        </span>
      </div>

      {/* Punch-out mood — erscheint nur nach dem Ausstempeln, ein Tap, weg */}
      {askMood && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {moodPicked ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--good)' }}>Notiert — fließt in Balance ein.</span>
          ) : (
            <React.Fragment>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>Wie war der Block?</span>
              {[['gut', 'Gut', 'var(--good)'], ['angespannt', 'Angespannt', 'var(--warn)'], ['gestresst', 'Gestresst', 'var(--bad)']].map(([id, label, color]) => (
                <button key={id} onClick={() => { setMoodPicked(id); setTimeout(() => { setAskMood(false); setMoodPicked(null); }, 2000); }} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', padding: '4px 0' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }}></span>{label}
                </button>
              ))}
            </React.Fragment>
          )}
        </div>
      )}

      {/* Drift event — one-tap replan (Co-Planner, AI signature) */}
      {driftEvent && (
        <div style={{ borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}>
          <div style={{ borderRadius: 'calc(var(--radius-card) - 1.5px)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--ai-grad)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>✦</span>
            <span style={{ flex: 1, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>
              <b style={{ color: 'var(--ink)', fontWeight: 600 }}>Nordwind Call → 15:00.</b> Tag neu planen?
            </span>
            <button onClick={replan} style={{ border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 11, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Neu planen</button>
            <button onClick={() => setDriftEvent(false)} style={{ border: 'none', background: 'none', color: 'var(--ink-3)', fontSize: 14, cursor: 'pointer', padding: 4, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}
      {planning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-2xs)', color: 'var(--accent-strong)', fontWeight: 600, animation: 'dtp-think 1s ease infinite' }}>
          ✦ Co-Planner ordnet den Rest des Tages neu …
        </div>
      )}
      {replanned && !planning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-2xs)', color: 'var(--good)', fontWeight: 600 }}>
          ✓ Neu geplant — Call auf 15:00, Reviews auf 16:00 verschoben.
        </div>
      )}

      {/* Überbuchungs-Regal — horizontal chips, NIE mehr Liste (bounded) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', whiteSpace: 'nowrap', flexShrink: 0 }}>⚠ Ohne Platz</span>
        {[['Vendor Call', '45m', 'var(--project-3)'], ['Review backlog', '1:30h', 'var(--project-4)'], ['Tech Spec', '1:05h', 'var(--project-2)']].map(([l, t, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 'var(--radius-pill)', border: '1.5px dashed var(--warn)', fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', flexShrink: 0, background: 'var(--surface)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c }}></span>{l}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
          </span>
        ))}
      </div>

      {/* Day Canvas — plan & reality on one surface */}
      <Card padding={false}>
        <div style={{ display: 'flex', padding: '12px 0' }}>
          <div style={{ position: 'relative', width: 44, height: (END - START) * HOUR_H, flexShrink: 0 }}>
            {Array.from({ length: END - START - 1 }, (_, i) => START + 1 + i).map((h) => (
              <span key={h} style={{ position: 'absolute', top: (h - START) * HOUR_H - 6, right: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}:00</span>
            ))}
          </div>
          <div style={{ position: 'relative', flex: 1, height: (END - START) * HOUR_H, marginRight: 10 }}>
            {Array.from({ length: END - START - 1 }, (_, i) => START + 1 + i).map((h) => (
              <div key={h} style={{ position: 'absolute', top: (h - START) * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.55 }}></div>
            ))}
            {canvasBlocks.map((b, i) => (
              <div key={i} style={blockStyle(b)} title={b.l + ' · ' + fmtT(b.s) + '–' + fmtT(b.s + b.d)}>
                {b.d >= 0.7 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {b.k === 'live' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--live)', flexShrink: 0 }}></span>}
                  <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.l}</span>
                </div>
                )}
                {b.d >= 1 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>{fmtT(b.s)}–{fmtT(b.s + b.d)}</div>}
                {b.k === 'ghost' && !ghostAccepted && (
                  <div style={{ position: 'absolute', right: 6, top: 5, display: 'flex', gap: 5 }}>
                    <button onClick={() => setGhostAccepted(true)} style={{ border: 'none', borderRadius: 'var(--radius-pill)', padding: '2px 9px', fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setGhostAccepted(true)} style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', padding: '2px 9px', fontSize: 9, fontWeight: 700, background: 'var(--surface)', color: 'var(--ink-2)', cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ position: 'absolute', top: (NOW - START) * HOUR_H, left: -4, right: 0, zIndex: 4, pointerEvents: 'none' }}>
              <div style={{ height: 2, background: 'var(--live)', boxShadow: '0 0 8px rgba(255,83,32,0.6)' }}></div>
              <span style={{ position: 'absolute', left: -2, top: -4, width: 9, height: 9, borderRadius: '50%', background: 'var(--live)' }}></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Einträge heute — Verteilungs-INSTRUMENT statt Endlos-Liste:
          Segment-Balken + Top 3 + Drill-in. Höhe konstant, egal ob 2 oder 12. */}
      {(() => {
        const entries = [
          ['ADR schreiben', '1:30', 'var(--project-2)', 21],
          ['Auth Bug', '1:10', 'var(--project-4)', 16],
          ['Roadmap Workshop', '1:00', 'var(--project-1)', 14],
          ['PR Reviews', '0:55', 'var(--project-5)', 13],
          ['Merge Konflikte', '0:50', 'var(--project-6)', 11],
          ['Incident Bridge', '0:45', 'var(--project-3)', 10],
          ['Nordwind Call', '0:40', 'var(--project-3)', 6],
          ['Finanzo Sync', '0:35', 'var(--project-1)', 4],
          ['Design Review', '0:30', 'var(--project-7)', 3],
          ['Standup', '0:30', 'var(--project-1)', 2],
        ];
        const shown = entriesOpen ? entries : entries.slice(0, 3);
        return (
          <Card padding={false}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>Einträge heute</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-sunk)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>{entries.length}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>8:25h</span>
              </div>
              {/* Das Instrument: die ganze Verteilung in einem Balken */}
              <div style={{ display: 'flex', height: 10, borderRadius: 'var(--radius-pill)', overflow: 'hidden', gap: 2, marginBottom: 12 }}>
                {entries.map(([l, , c, pct]) => <span key={l} style={{ width: pct + '%', background: c }}></span>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {shown.map(([l, t, c]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }}></span>
                    <span style={{ flex: 1, fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setEntriesOpen(!entriesOpen)} style={{
              width: '100%', border: 'none', borderTop: '1px solid var(--border)', background: 'none',
              padding: '10px 16px', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--accent-strong)',
              cursor: 'pointer', fontFamily: 'var(--font-ui)',
            }}>{entriesOpen ? 'Weniger anzeigen' : '+' + (entries.length - 3) + ' weitere anzeigen'}</button>
          </Card>
        );
      })()}
    </div>
  );

  const planner = (
    <div style={{ padding: 16, paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Planner <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>KW 28</span></div>
      {[
        { d: 'Mo', total: '7,2h', segs: [['var(--project-1)', 38], ['var(--project-2)', 28], ['var(--project-4)', 20]] },
        { d: 'Di', total: '5,4h', today: true, segs: [['var(--project-1)', 25], ['var(--project-3)', 12], ['var(--project-2)', 30]] },
        { d: 'Mi', total: '6,5h', segs: [['var(--project-3)', 30], ['var(--project-2)', 45]] },
        { d: 'Do', total: '7,0h', segs: [['var(--project-1)', 45], ['var(--project-3)', 14], ['var(--project-2)', 28]] },
        { d: 'Fr', total: 'Urlaub', segs: [] },
      ].map((row) => (
        <div key={row.d} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: row.today ? 'var(--accent-soft)' : 'var(--surface)', border: '1px solid ' + (row.today ? 'var(--accent-border)' : 'var(--border)'), borderRadius: 'var(--radius-card)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: row.today ? 'var(--accent-strong)' : 'var(--ink)', width: 26 }}>{row.d}</span>
          <div style={{ flex: 1, display: 'flex', height: 12, borderRadius: 'var(--radius-pill)', overflow: 'hidden', gap: 2, background: 'var(--surface-sunk)' }}>
            {row.segs.map(([c, w], i) => <span key={i} style={{ width: w + '%', background: c }}></span>)}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', width: 44, textAlign: 'right' }}>{row.total}</span>
        </div>
      ))}
      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>Volles Wochen-Gantt mit Drag &amp; Drop → Tablet/Desktop.</div>
    </div>
  );

  const projects = (() => {
    // Bounded: sortiert nach Budget-Risiko, Top 3 sichtbar, Rest per Drill-in.
    const all = [
      { n: 'Nordwind GmbH', c: 'var(--project-3)', pct: 91, h: '72,8h' },
      { n: 'Finanzo AG', c: 'var(--project-1)', pct: 62, h: '96,5h' },
      { n: 'Sync engine', c: 'var(--project-2)', pct: 34, h: '41,2h' },
      { n: 'Atlas Relaunch', c: 'var(--project-4)', pct: 18, h: '14,5h' },
      { n: 'Huber CMS', c: 'var(--project-5)', pct: 11, h: '6,0h' },
    ];
    const shown = projectsOpen ? all : all.slice(0, 3);
    return (
      <div style={{ padding: 16, paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Projects</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-sunk)', borderRadius: 'var(--radius-pill)', padding: '2px 8px' }}>{all.length}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: 'var(--ink-3)' }}>nach Budget-Risiko</span>
        </div>
        {shown.map((p) => (
          <Card key={p.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: 'color-mix(in srgb, ' + p.c + ' 16%, var(--surface))', color: p.c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{p.n.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>{p.n}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{p.h}</div>
              </div>
              <BudgetRing percent={p.pct} color={p.c} size={48} />
              {p.pct >= 80 && <Badge tone="warn">!</Badge>}
            </div>
          </Card>
        ))}
        <button onClick={() => setProjectsOpen(!projectsOpen)} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', background: 'var(--surface)',
          padding: '9px 16px', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--accent-strong)',
          cursor: 'pointer', fontFamily: 'var(--font-ui)', alignSelf: 'center',
        }}>{projectsOpen ? 'Weniger anzeigen' : '+' + (all.length - 3) + ' weitere anzeigen'}</button>
      </div>
    );
  })();

  const reports = (
    <div style={{ padding: 16, paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Reports</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatTile label="Billable" value="128.5h" delta={12} />
        <StatTile label="Meetings" value="14" delta={3} />
      </div>
      <Card title="Budget burn-down" subtitle="Nordwind · erschöpft ~21.7.">
        <svg viewBox="0 0 300 90" style={{ width: '100%', display: 'block' }}>
          <line x1="0" y1="82" x2="300" y2="82" stroke="var(--border)" strokeWidth="1" />
          <polyline points="0,8 30,13 60,23 90,28 120,43 150,55" fill="none" stroke="var(--project-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="150,55 210,70 258,82" fill="none" stroke="var(--project-3)" strokeWidth="2" strokeDasharray="5 5" opacity="0.55" />
          <circle cx="150" cy="55" r="4" fill="var(--live)" />
        </svg>
      </Card>
      <Card title="Balance" subtitle="Diese Woche · keine Diagnose">
        <LoadMeter score={64} width={280} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {[['warn', '3. Woche über Soll'], ['warn', '2× Pause übersprungen'], ['good', 'Keine Abend-Sessions']].map(([tone, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone === 'warn' ? 'var(--warn)' : 'var(--good)', flexShrink: 0 }}></span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}>
          <div style={{ borderRadius: 'calc(var(--radius-card) - 1.5px)', background: 'var(--surface)', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--ai-grad)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✦</span>
            <span style={{ flex: 1, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>Belastung steigt.</b> Do meetingfrei + Feierabend 17:30?</span>
            <button style={{ border: 'none', borderRadius: 'var(--radius-pill)', padding: '5px 11px', fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Übernehmen</button>
          </div>
        </div>
      </Card>
    </div>
  );

  const profile = (
    <div style={{ padding: 16, paddingBottom: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Profile</div>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #3D5CF5, #2941B8)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>SS</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>Suhay Sevinc</div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>Soll 8:20h/Tag · Saldo <b style={{ color: 'var(--good)', fontFamily: 'var(--font-mono)' }}>+9:30h</b></div>
          </div>
          <Badge tone="accent">Pro</Badge>
        </div>
      </Card>
      {/* Abwesenheit — no 6th tab (thumb rule): the account lives here,
          glanceable; Anträge + Feiertage per Drill-in. Full year grid → Desktop. */}
      <Card padding={false}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>Abwesenheit</span>
            <button style={{ marginLeft: 'auto', border: 'none', borderRadius: 'var(--radius-pill)', padding: '6px 12px', fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Antrag stellen</button>
          </div>
          <LeaveBalance entitlement={30} taken={11} planned={5} carryover={2} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Gleitzeit</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--good)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>+12:40</div>
            </div>
            <div style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Krank</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>3 Tage</div>
            </div>
            <div style={{ flex: 1.4, padding: '9px 12px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Nächster Feiertag</div>
              <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink)', marginTop: 3 }}>Sa 3.10. Dt. Einheit</div>
            </div>
          </div>
          {absenceOpen && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--ink)' }}>Urlaub · 10.–14. Aug</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>5 Tage</div>
                </div>
                <Badge tone="good">Genehmigt</Badge>
              </div>
              <div style={{ borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}>
                <div style={{ borderRadius: 'calc(var(--radius-card) - 1.5px)', background: 'var(--surface)', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--ai-grad)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✦</span>
                  <span style={{ flex: 1, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>Brückentag:</b> Fr 15.5. → 4 freie Tage für 1 Urlaubstag.</span>
                  <button style={{ border: 'none', borderRadius: 'var(--radius-pill)', padding: '5px 11px', fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>Anfragen</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => setAbsenceOpen(!absenceOpen)} style={{
          width: '100%', border: 'none', borderTop: '1px solid var(--border)', background: 'none',
          padding: '10px 16px', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--accent-strong)',
          cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}>{absenceOpen ? 'Weniger anzeigen' : 'Anträge & Feiertage anzeigen'}</button>
      </Card>
      <Card title="Darstellung">
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['blueprint', 'sovereign', 'ember'].map((t) => (
            <button key={t} onClick={() => setTheme(t)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-block)', cursor: 'pointer',
              border: '1.5px solid ' + (theme === t ? 'var(--accent)' : 'var(--border)'),
              background: theme === t ? 'var(--accent-soft)' : 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--ink)',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: t === 'blueprint' ? 'var(--blueprint-500)' : t === 'sovereign' ? 'var(--sovereign-500)' : 'var(--ember-500)' }}></span>
              {t === 'blueprint' ? 'Königsblau' : t === 'sovereign' ? 'Sovereign' : 'Ember'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['light', 'Hell'], ['dark', 'Dunkel']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-block)', cursor: 'pointer',
              border: '1.5px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
              background: mode === m ? 'var(--accent-soft)' : 'var(--surface)',
              fontSize: 10, fontWeight: 700, color: 'var(--ink)',
            }}>{label}</button>
          ))}
        </div>
      </Card>
    </div>
  );

  const content = { today, planner, projects, reports, profile };

  return (
    <div data-theme={theme} data-mode={mode} style={{ height: '100vh', width: '100%', maxWidth: 430, margin: '0 auto', background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
      <AppShell posture="tabs" active={tab} onNavigate={setTab}>
        {/* Keep all tabs mounted so mood taps / dismissed banners survive tab switches */}
        {Object.entries(content).map(([id, node]) => (
          <div key={id} style={{ display: tab === id ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
            {node}
          </div>
        ))}
      </AppShell>
      {tab !== 'today' && (
        <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 40 }}>
          <Island
            running={running}
            elapsed={fmt(secs)}
            punched
            expanded={expanded}
            onToggle={() => setExpanded(!expanded)}
            actions={[
              running ? { label: paused ? 'Weiter' : 'Pause', onClick: () => setPaused(!paused) } : { label: 'Start', onClick: () => setRunning(true) },
              running ? { label: 'Stop', onClick: () => { setRunning(false); setPaused(false); setAskMood(true); } } : { label: 'Today', onClick: () => setTab('today') },
              { label: 'Ausstempeln', onClick: () => { setRunning(false); setPaused(false); setAskMood(true); } },
            ]}
          />
        </div>
      )}
    </div>
  );
}
const __dtPhoneRootEl = document.getElementById('root');
__dtPhoneRootEl.__reactRoot = __dtPhoneRootEl.__reactRoot || ReactDOM.createRoot(__dtPhoneRootEl);
__dtPhoneRootEl.__reactRoot.render(<PhoneApp />);
