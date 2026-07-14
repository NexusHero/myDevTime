// PlannerViews — Monat- und Jahres-Facette des Planners.
// Grundgesetz beider Ansichten: TASKS (geplante Arbeit, zählen in die
// Auslastung) und EVENTS (Feiertag, Firmen-Event, Info — zählen NIE,
// blockieren NIE) sind auf den ersten Blick unterscheidbar:
//   Task  = gefüllter Chip mit Projektfarbe + Prio-Punkt
//   Event = flaches Banner GANZ OBEN in der Zelle, Wimpel-Glyph, kein Fill
// Tag-Schwere: Balken unten in jeder Zelle — prio-gewichtete Stunden vs. Soll.

const FlagGlyph = ({ color = 'var(--violet, #7c6cf3)' }) => (
  <svg width="8" height="10" viewBox="0 0 8 10" style={{ flexShrink: 0, display: 'block' }}>
    <path d="M1 0.5 V9.5 M1 1 H7 L5.4 2.9 L7 4.8 H1" fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

const EVENT_C = 'var(--project-11, #7c6cf3)';

// prio-gewichtete Schwere: P1 wiegt 1.4, P2 1.0, P3 0.7
const dayLoad = (tasks) => tasks.reduce((s, t) => s + t.est * (t.prio === 1 ? 1.4 : t.prio === 2 ? 1 : 0.7), 0);
const loadColor = (load, soll) =>
  load === 0 ? 'var(--border)' : load <= soll * 0.85 ? 'var(--good)' : load <= soll ? 'var(--warn)' : 'var(--bad)';

// ---------- MONAT ----------
function PlannerMonth({ onDrill }) {
  const SOLL = 8.33;
  // Juli 2026: 1.7. = Mittwoch → Offset 2 (Mo-Start). 31 Tage.
  const OFFSET = 2, DAYS = 31, TODAY = 13;
  // Deterministische Demo-Daten. t: [prio, est, label, projektfarbe]
  const D = {
    1: { t: [[2, 2, 'Finanzo API', 1], [3, 1, 'PR-Reviews', 4]] },
    2: { t: [[1, 3, 'Sync: CRDT merge', 2], [2, 1.5, 'Staging-Deploy', 3]] },
    3: { t: [[2, 2, 'Audit-Log', 1]], e: ['Sommerfest (nachm.)'] },
    6: { t: [[1, 2.5, 'SSO Entra ID', 3], [2, 2, 'Finanzo Review', 1], [3, 0.5, 'PR #412', 4]] },
    7: { t: [[1, 3, 'Offline-Queue', 2], [2, 1, 'Retry-Backoff', 2]] },
    8: { t: [[2, 2, 'Rundungsfehler', 1], [2, 1.5, 'Report-PDF', 3], [3, 1, 'Changelog', 2]] },
    9: { t: [[1, 2, 'LCP mobil', 4], [3, 0.5, 'PR #77', 4]] },
    10: { t: [[2, 2, 'Mandanten-Import', 1]] },
    13: { t: [[1, 2, 'Sync engine', 2], [2, 1.5, 'Finanzo Review', 1], [2, 0.75, 'Nordwind Call', 3], [3, 0.75, 'Review backlog', 4]] },
    14: { t: [[1, 3, 'Deep work: Sync', 2], [2, 1, 'Pairing', 2]], e: ['Zahnarzt 16:30'] },
    15: { t: [[1, 3, 'Finanzo API', 1], [2, 1, 'Client call', 3], [1, 2, 'Sync engine', 2]] },
    16: { t: [[2, 2.5, 'Nordwind Sprint', 3], [3, 1, 'Dashboard-Widgets', 3]] },
    17: {},
    20: { t: [[2, 2, 'Hero-Section CMS', 4], [2, 1, 'Mega-Menu A11y', 4]] },
    21: { t: [[1, 3, 'SEPA-Export', 1], [3, 0.75, 'Flaky test', 1]] },
    22: { t: [[2, 2, 'Delta-Sync Telemetrie', 2]], e: ['Meetup Freiburg 19:00'] },
    23: { t: [[2, 2.5, 'Onboarding-Checkliste', 1], [3, 1, 'Cookie-Banner', 4]] },
    24: { t: [[3, 1.5, 'Bildpipeline AVIF', 4]] },
    27: { t: [[1, 2.5, 'Sync: Konflikt-UI', 2], [2, 2, 'Audit-Log II', 1]] },
    28: { t: [[2, 2, 'Nordwind Review', 3]] },
    29: { t: [[1, 2, 'Release 1.4 vorbereiten', 2], [2, 1, 'PR-Sweep', 4]], e: ['Release-Day'] },
    30: { t: [[3, 1, 'Docs-Pass', 2]] },
    31: {},
  };
  // Urlaub Fr 17.7. + Feiertage als Events
  const HOLIDAY = { 17: 'Urlaub' };
  const PC = { 1: 'var(--project-1)', 2: 'var(--project-2)', 3: 'var(--project-3)', 4: 'var(--project-4)' };
  const prioDot = { 1: 'var(--bad)', 2: 'var(--warn)', 3: 'var(--ink-3)' };
  const cells = [];
  for (let i = 0; i < OFFSET; i++) cells.push(null);
  for (let d = 1; d <= DAYS; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
          <div key={w} style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={'x' + i} style={{ minHeight: 96, borderBottom: '1px solid var(--border)', borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface-sunk)', opacity: 0.4 }}></div>;
          const wk = i % 7 >= 5;
          const info = D[d] || {};
          const tasks = (info.t || []).map(([prio, est, l, p]) => ({ prio, est, l, p }));
          const events = [...(info.e || []), ...(HOLIDAY[d] ? [HOLIDAY[d]] : [])];
          const load = dayLoad(tasks);
          const isToday = d === TODAY;
          const shown = tasks.slice(0, 3);
          return (
            <div key={d} onClick={() => onDrill && onDrill(d)} style={{
              minHeight: 96, padding: '6px 7px 8px', boxSizing: 'border-box', cursor: 'pointer',
              borderBottom: '1px solid var(--border)', borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)',
              background: isToday ? 'color-mix(in srgb, var(--accent-soft) 55%, transparent)' : wk ? 'color-mix(in srgb, var(--surface-sunk) 45%, transparent)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: 3, position: 'relative',
              transition: 'background var(--dur-fast) var(--ease-out)',
            }}
              onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.background = 'var(--surface-sunk)'; }}
              onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.background = wk ? 'color-mix(in srgb, var(--surface-sunk) 45%, transparent)' : 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isToday ? 700 : 600, fontVariantNumeric: 'tabular-nums',
                  color: isToday ? '#fff' : wk ? 'var(--ink-3)' : 'var(--ink-2)',
                  background: isToday ? 'var(--live)' : 'transparent',
                  borderRadius: 'var(--radius-pill)', padding: isToday ? '1px 7px' : '1px 0',
                }}>{d}</span>
                {load > 0 && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{load.toFixed(1).replace('.', ',')}</span>}
              </div>
              {/* EVENTS — Banner ganz oben, hohl, Wimpel: nie Arbeit, nie gezählt */}
              {events.map((ev) => (
                <span key={ev} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px',
                  borderRadius: 4, border: '1px dashed ' + EVENT_C, color: EVENT_C,
                  fontSize: 9.5, fontWeight: 600, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  background: 'transparent', boxSizing: 'border-box',
                }}><FlagGlyph color={EVENT_C} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev}</span></span>
              ))}
              {/* TASKS — gefüllte Chips, Prio-Punkt + Projektfarbe */}
              {shown.map((t, ti) => (
                <span key={ti} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px',
                  borderRadius: 4, background: 'color-mix(in srgb, ' + PC[t.p] + ' 15%, var(--surface))',
                  borderLeft: '2.5px solid ' + PC[t.p], color: 'var(--ink)',
                  fontSize: 9.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: prioDot[t.prio], flexShrink: 0 }}></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.l}</span>
                </span>
              ))}
              {tasks.length > 3 && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)' }}>+{tasks.length - 3} weitere</span>}
              {/* Schwere-Balken: prio-gewichtete Stunden vs. Soll */}
              <span style={{ marginTop: 'auto', height: 3, borderRadius: 2, background: 'var(--surface-sunk)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: Math.min(load / SOLL, 1) * 100 + '%', height: '100%', borderRadius: 2, background: loadColor(load, SOLL) }}></span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- JAHR ----------
function PlannerYear({ onDrill }) {
  const MONTHS = [
    { n: 'Jan', h: 152, load: [2, 2, 1, 2, 1], ev: 1 }, { n: 'Feb', h: 148, load: [2, 1, 2, 2, 0], ev: 0 },
    { n: 'Mär', h: 166, load: [2, 3, 2, 2, 1], ev: 1 }, { n: 'Apr', h: 141, load: [1, 2, 2, 1, 1], ev: 2 },
    { n: 'Mai', h: 155, load: [2, 2, 3, 2, 1], ev: 2 }, { n: 'Jun', h: 172, load: [3, 3, 2, 3, 2], ev: 0 },
    { n: 'Jul', h: 76, load: [2, 3, 0, 0, 0], ev: 3, now: true }, { n: 'Aug', h: 0, load: [1, 0, 0, 0, 0], ev: 1 },
    { n: 'Sep', h: 0, load: [1, 1, 0, 0, 0], ev: 0 }, { n: 'Okt', h: 0, load: [0, 0, 0, 0, 0], ev: 1 },
    { n: 'Nov', h: 0, load: [0, 0, 0, 0, 0], ev: 0 }, { n: 'Dez', h: 0, load: [0, 0, 0, 0, 0], ev: 2 },
  ];
  const heat = ['var(--surface-sunk)', 'color-mix(in srgb, var(--accent) 25%, var(--surface))', 'color-mix(in srgb, var(--accent) 55%, var(--surface))', 'var(--accent)'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, padding: '14px 0' }}>
      {MONTHS.map((m) => (
        <div key={m.n} onClick={() => onDrill && onDrill(m.n)} style={{
          border: m.now ? '1.5px solid var(--live-border)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-card)', padding: '12px 14px', cursor: 'pointer',
          background: 'var(--surface)', boxShadow: m.now ? '0 8px 24px -12px rgba(255,83,32,0.35)' : 'none',
          transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = m.now ? '0 8px 24px -12px rgba(255,83,32,0.35)' : 'none'; }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: m.now ? 'var(--live)' : 'var(--ink)' }}>{m.n}</span>
            {m.now && <span style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--live)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>Jetzt</span>}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{m.h > 0 ? m.h + 'h' : '—'}</span>
          </div>
          {/* Wochen-Intensität: 5 Zeilen = 5 Wochen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {m.load.map((lv, wi) => (
              <span key={wi} style={{ height: 6, borderRadius: 2, background: heat[lv], transition: 'background var(--dur-med) var(--ease-out)' }}></span>
            ))}
          </div>
          {/* Events als Wimpel-Reihe — getrennt von Arbeit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, minHeight: 12 }}>
            {Array.from({ length: m.ev }).map((_, i) => <FlagGlyph key={i} color={EVENT_C} />)}
            {m.ev > 0 && <span style={{ fontSize: 9, color: 'var(--ink-3)', fontStyle: 'italic' }}>{m.ev} Event{m.ev > 1 ? 's' : ''}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { PlannerMonth, PlannerYear, DTFlagGlyph: FlagGlyph });
