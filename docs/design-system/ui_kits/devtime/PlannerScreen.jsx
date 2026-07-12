function PlannerScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, Button } = DS;
  const AIAskBar = DS.AIAskBar || (() => null);
  const HOUR_H = 44;
  const START = 8, END = 18;
  const hours = [];
  for (let h = START; h <= END; h++) hours.push(h);
  const colH = (END - START) * HOUR_H;

  const days = [
    { name: 'Mon', date: '7.7.', total: '7,2h' },
    { name: 'Tue', date: '8.7.', total: '5,4h', today: true },
    { name: 'Wed', date: '9.7.', total: '6,5h' },
    { name: 'Thu', date: '10.7.', total: '7,0h' },
    { name: 'Fri', date: '11.7.', total: '—' },
  ];

  // day: 0–4 · s/d in decimal hours · kind: actual | meeting | ghost
  const [blocks, setBlocks] = React.useState([
    { id: 1, day: 0, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting' },
    { id: 2, day: 0, s: 9.5, d: 2.5, l: 'Finanzo API', c: 'var(--project-1)', k: 'actual' },
    { id: 3, day: 0, s: 13, d: 2, l: 'Sync engine', c: 'var(--project-2)', k: 'actual' },
    { id: 4, day: 0, s: 15.5, d: 1.5, l: 'Code review', c: 'var(--project-4)', k: 'actual' },
    { id: 5, day: 1, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting' },
    { id: 18, day: 0, s: 12.5, d: 0.5, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 19, day: 1, s: 12, d: 0.75, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 20, day: 2, s: 12.5, d: 0.5, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 21, day: 3, s: 12.5, d: 0.75, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 6, day: 1, s: 9.5, d: 1.5, l: 'Finanzo Review', c: 'var(--project-1)', k: 'actual' },
    { id: 7, day: 1, s: 11.25, d: 0.75, l: 'Nordwind Call', c: 'var(--project-3)', k: 'meeting' },
    { id: 8, day: 1, s: 13, d: 2, l: 'Deep work: Sync engine', c: 'var(--project-2)', k: 'ghost' },
    { id: 9, day: 1, s: 15.25, d: 0.75, l: 'Review backlog', c: 'var(--project-4)', k: 'ghost' },
    { id: 10, day: 2, s: 9, d: 2, l: 'Nordwind Sprint', c: 'var(--project-3)', k: 'actual' },
    { id: 11, day: 2, s: 11.5, d: 1, l: 'Pairing', c: 'var(--project-2)', k: 'meeting' },
    { id: 12, day: 2, s: 13.5, d: 3, l: 'Deep work', c: 'var(--project-2)', k: 'ghost' },
    { id: 13, day: 3, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting' },
    { id: 14, day: 3, s: 10, d: 3, l: 'Finanzo API', c: 'var(--project-1)', k: 'ghost' },
    { id: 15, day: 3, s: 14, d: 1, l: 'Client call', c: 'var(--project-3)', k: 'meeting' },
    { id: 16, day: 3, s: 15.5, d: 2, l: 'Sync engine', c: 'var(--project-2)', k: 'ghost' },
    { id: 17, day: 4, s: 9, d: 8, l: 'Urlaub', c: 'var(--neutral-400)', k: 'ghost' },
  ]);

  const NOW = 14.33;
  const GUTTER = 52;

  // ---- Task-Inbox: assigned Jira/Linear tickets land HERE, not in the
  //      calendar. Built for volume: search + filter + project groups +
  //      own scroll pane. "Planen" finds the next free slot and drops the
  //      ticket as a GHOST (proposal — you commit by leaving it). ----
  const [inboxOpen, setInboxOpen] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('Alle');
  const [srcFilter, setSrcFilter] = React.useState('Alle');
  const PROJ = [
    { n: 'Finanzo AG', c: 'var(--project-1)' },
    { n: 'Sync engine', c: 'var(--project-2)' },
    { n: 'Nordwind GmbH', c: 'var(--project-3)' },
    { n: 'Atlas Relaunch', c: 'var(--project-4)' },
  ];
  const [tasks, setTasks] = React.useState([
    { key: 'FIN-231', t: 'SEPA-Export: Sammellastschrift', est: 2, prio: 1, tag: 'Feature', p: 0, src: 'Jira' },
    { key: 'FIN-228', t: 'Rundungsfehler Rechnungssumme', est: 1, prio: 1, tag: 'Bug', p: 0, src: 'Jira' },
    { key: 'FIN-224', t: 'Audit-Log für Buchungen', est: 3, prio: 2, tag: 'Feature', p: 0, src: 'Jira' },
    { key: 'FIN-219', t: 'PR #412 reviewen', est: 0.5, prio: 2, tag: 'Review', p: 0, src: 'GitHub' },
    { key: 'FIN-215', t: 'Mandanten-Import CSV', est: 2, prio: 3, tag: 'Feature', p: 0, src: 'Jira' },
    { key: 'FIN-209', t: 'Flaky test: invoice.spec', est: 0.75, prio: 3, tag: 'Bug', p: 0, src: 'GitHub' },
    { key: 'SYNC-142', t: 'Conflict resolution: CRDT merge', est: 3, prio: 1, tag: 'Feature', p: 1, src: 'Linear' },
    { key: 'SYNC-139', t: 'Offline-Queue läuft voll', est: 1.5, prio: 1, tag: 'Bug', p: 1, src: 'Linear' },
    { key: 'SYNC-137', t: 'Retry-Backoff konfigurierbar', est: 1, prio: 2, tag: 'Feature', p: 1, src: 'Linear' },
    { key: 'SYNC-133', t: 'PR #98 reviewen', est: 0.5, prio: 2, tag: 'Review', p: 1, src: 'GitHub' },
    { key: 'SYNC-128', t: 'Delta-Sync Telemetrie', est: 2, prio: 3, tag: 'Feature', p: 1, src: 'Linear' },
    { key: 'NW-87', t: 'Login: SSO via Entra ID', est: 3, prio: 1, tag: 'Feature', p: 2, src: 'Jira' },
    { key: 'NW-85', t: 'Report-PDF: Umlaute kaputt', est: 0.75, prio: 2, tag: 'Bug', p: 2, src: 'Jira' },
    { key: 'NW-82', t: 'Staging-Deploy reparieren', est: 1, prio: 2, tag: 'Bug', p: 2, src: 'GitHub' },
    { key: 'NW-79', t: 'PR #201 reviewen', est: 0.5, prio: 3, tag: 'Review', p: 2, src: 'GitHub' },
    { key: 'NW-75', t: 'Dashboard-Widgets sortierbar', est: 2, prio: 3, tag: 'Feature', p: 2, src: 'Jira' },
    { key: '#44', t: 'Hero-Section CMS-Anbindung', est: 2, prio: 2, tag: 'Feature', p: 3, src: 'GitHub' },
    { key: '#41', t: 'Lighthouse: LCP > 4s mobil', est: 1.5, prio: 1, tag: 'Bug', p: 3, src: 'GitHub' },
    { key: '#39', t: 'Navigation: Mega-Menu A11y', est: 1, prio: 2, tag: 'Bug', p: 3, src: 'GitHub' },
    { key: '#36', t: 'PR #77 reviewen', est: 0.5, prio: 3, tag: 'Review', p: 3, src: 'GitHub' },
    { key: '#33', t: 'Bildpipeline auf AVIF', est: 2, prio: 3, tag: 'Feature', p: 3, src: 'GitHub' },
    { key: '#29', t: 'Cookie-Banner Consent-Mode', est: 1, prio: 3, tag: 'Feature', p: 3, src: 'GitHub' },
    { key: 'SYNC-121', t: 'Changelog-Generator', est: 1, prio: 3, tag: 'Feature', p: 1, src: 'Linear' },
    { key: 'FIN-201', t: 'Onboarding-Checkliste Steuerberater', est: 1.5, prio: 3, tag: 'Feature', p: 0, src: 'Jira' },
  ]);
  const nextIdRef = React.useRef(100);

  const planTask = (task) => {
    // next free slot: today from "now", then following days from 08:00
    setBlocks((bs) => {
      for (let day = 1; day <= 4; day++) {
        const occ = bs.filter((b) => b.day === day).map((b) => [b.s, b.s + b.d]).sort((a, b2) => a[0] - b2[0]);
        let s = day === 1 ? Math.ceil(NOW * 4) / 4 + 0.25 : START;
        while (s + task.est <= END) {
          const clash = occ.find(([a, e]) => s < e && s + task.est > a);
          if (!clash) {
            return [...bs, { id: nextIdRef.current++, day, s, d: task.est, l: task.key + ' · ' + task.t, c: PROJ[task.p].c, k: 'ghost' }];
          }
          s = Math.ceil(clash[1] * 4) / 4;
        }
      }
      return bs;
    });
    setTasks((ts) => ts.filter((x) => x.key !== task.key));
  };

  const prioDot = { 1: 'var(--bad)', 2: 'var(--warn)', 3: 'var(--ink-3)' };
  const visibleTasks = tasks.filter((t) =>
    (tagFilter === 'Alle' || t.tag === tagFilter) &&
    (srcFilter === 'Alle' || t.src === srcFilter) &&
    (q === '' || (t.key + ' ' + t.t).toLowerCase().includes(q.toLowerCase()))
  );

  // ---- Drag & drop: grab a block, move across time AND days, snap to 15 min ----
  const bodyRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null); // { id, dy }

  const startDrag = (e, b) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({ id: b.id, dy: e.clientY - rect.top });
  };

  React.useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const rect = bodyRef.current.getBoundingClientRect();
      const colW = (rect.width - GUTTER) / 5;
      const day = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left - GUTTER) / colW)));
      setBlocks((bs) => bs.map((b) => {
        if (b.id !== drag.id) return b;
        const raw = START + (e.clientY - rect.top - drag.dy) / HOUR_H;
        const s = Math.max(START, Math.min(END - b.d, Math.round(raw * 4) / 4));
        return { ...b, day, s };
      }));
    };
    const up = () => setDrag(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [drag]);

  const blockStyle = (b, dragging) => {
    const tiny = b.d < 0.5;
    const base = {
      position: 'absolute', left: 4, right: 4,
      top: (b.s - START) * HOUR_H + 1,
      height: b.d * HOUR_H - 3,
      borderRadius: tiny ? 5 : 'var(--radius-block)',
      padding: tiny ? 0 : '5px 8px', overflow: 'hidden', boxSizing: 'border-box',
      fontSize: 'var(--fs-2xs)', lineHeight: 1.25,
      cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
      zIndex: dragging ? 10 : 1,
      boxShadow: dragging ? 'var(--shadow-lg)' : 'none',
      transform: dragging ? 'scale(1.03)' : 'scale(1)',
      transition: dragging ? 'none' : 'top var(--dur-med) var(--ease-spring), transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out)',
    };
    if (b.k === 'break') return { ...base, background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 5px, transparent 5px 10px)', border: '1px dashed var(--border-strong)', color: 'var(--ink-3)' };
    if (b.k === 'ghost') return { ...base, border: '1.5px dashed ' + b.c, background: dragging ? 'var(--surface)' : 'transparent', color: 'var(--ink-2)' };
    if (b.k === 'meeting') return { ...base, background: b.c, color: '#fff' };
    return { ...base, background: 'color-mix(in srgb, ' + b.c + ' 14%, var(--surface))', borderLeft: '3px solid ' + b.c, color: 'var(--ink)' };
  };

  const fmtT = (h) => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap', rowGap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1, minWidth: 160 }}>Planner</div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 6px', background: 'var(--surface)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 8px' }}>‹</button>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)' }}>KW 28</span>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 8px' }}>›</button>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <b style={{ color: 'var(--ink)', fontWeight: 600 }}>26,1h</b> / 41:40h
        </span>
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Button size="sm" variant={inboxOpen ? 'primary' : 'ghost'} onClick={() => setInboxOpen(!inboxOpen)}>Inbox · {tasks.length}</Button>
        </span>
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}><Button size="sm">Woche planen</Button></span>
      </div>

      {/* AI reachable in context — not just in the Assistant tab */}
      <div style={{ marginBottom: 16, maxWidth: 680 }}>
        <AIAskBar
          scopes={['Zeiten', 'Budgets']}
          answers={{
            "Wo wird's diese Woche eng?": 'Donnerstag: 9,3h geplant bei 8:20h Soll — und der Nordwind-Block (2h) würde das Restbudget (7,2h) auf 5,2h drücken. Vorschlag: Review-Block auf Freitagvormittag ziehen.',
            'Schaffe ich mein Wochen-Soll?': 'Knapp: 26,1h gebucht + 14,5h geplant = 40,6h bei 41:40h Soll. Es fehlen ~1h — Freitag ist noch frei bis auf Urlaub.',
          }}
        />
      </div>

      {/* Arbeitsfläche: Inbox-Rail (eigener Scroll) + Kalender (eigener Scroll) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, margin: '0 -28px', padding: '2px 28px 0', overflow: 'hidden' }}>
        {inboxOpen && (
          <div style={{ width: 268, flexShrink: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>Inbox</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--surface-sunk)', borderRadius: 'var(--radius-pill)', padding: '2px 8px', fontVariantNumeric: 'tabular-nums' }}>{visibleTasks.length}{visibleTasks.length !== tasks.length ? '/' + tasks.length : ''}</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 600, color: 'var(--ink-3)' }}>3 Quellen · vor 2 min</span>
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Suchen (Key, Titel) …"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', background: 'var(--surface-sunk)', color: 'var(--ink)', fontSize: 'var(--fs-2xs)', outline: 'none', fontFamily: 'var(--font-ui)', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                {['Alle', 'Bug', 'Feature', 'Review'].map((f) => (
                  <button key={f} onClick={() => setTagFilter(f)} style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    border: tagFilter === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: tagFilter === f ? 'var(--accent-soft)' : 'var(--surface)',
                    color: tagFilter === f ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{f}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginRight: 2 }}>Quelle</span>
                {['Alle', 'Jira', 'Linear', 'GitHub'].map((f) => (
                  <button key={f} onClick={() => setSrcFilter(f)} style={{
                    padding: '3px 9px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    border: srcFilter === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: srcFilter === f ? 'var(--accent-soft)' : 'var(--surface)',
                    color: srcFilter === f ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 10px' }}>
              {PROJ.map((proj, pi) => {
                const group = visibleTasks.filter((t) => t.p === pi);
                if (group.length === 0) return null;
                return (
                  <div key={proj.n}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 6px 5px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: proj.c, flexShrink: 0 }}></span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>{proj.n}</span>
                      <span style={{ fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{group.length}</span>
                    </div>
                    {group.map((t) => (
                      <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 'var(--radius-lg)', cursor: 'default' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunk)'; e.currentTarget.querySelector('button').style.opacity = 1; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('button').style.opacity = 0; }}>
                        <span title={'Priorität ' + t.prio} style={{ width: 7, height: 7, borderRadius: '50%', background: prioDot[t.prio], flexShrink: 0 }}></span>
                        <span title={t.src} style={{ width: 15, height: 15, borderRadius: 4, background: 'var(--surface-sunk)', border: '1px solid var(--border)', boxSizing: 'border-box', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 800, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{t.src[0]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>{t.key}</span>
                            <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.t}</span>
                          </div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{t.est}h</span>
                        <button onClick={() => planTask(t)} style={{ opacity: 0, transition: 'opacity var(--dur-fast) var(--ease-out)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '3px 9px', fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>Planen</button>
                      </div>
                    ))}
                  </div>
                );
              })}
              {visibleTasks.length === 0 && (
                <div style={{ padding: '22px 10px', textAlign: 'center', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>Nichts gefunden — Filter oder Suche anpassen.</div>
              )}
            </div>
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '8px 12px', fontSize: 9, color: 'var(--ink-3)', display: 'flex', gap: 10 }}>
              <span>„Planen“ legt einen Ghost in den nächsten freien Slot · Quellen: Jira, Linear, GitHub — verwaltet im Profil</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingBottom: 8 }}>
      <Card padding={false}>
        {/* header row */}
        <div style={{ display: 'grid', gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)' }}>
          <div style={{ borderBottom: '1px solid var(--border)' }}></div>
          {days.map((d) => (
            <div key={d.name} style={{
              padding: '10px 12px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)',
              background: d.today ? 'var(--accent-soft)' : 'transparent',
              display: 'flex', alignItems: 'baseline', gap: 6,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: d.today ? 'var(--accent-strong)' : 'var(--ink)' }}>{d.name}</span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>{d.date}</span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{d.total}</span>
            </div>
          ))}
        </div>

        {/* body grid — drag surface */}
        <div ref={bodyRef} style={{ display: 'grid', gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)' }}>
          <div style={{ position: 'relative', height: colH }}>
            {hours.slice(0, -1).map((h) => (
              <div key={h} style={{
                position: 'absolute', top: (h - START) * HOUR_H - 7, right: 8,
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums',
              }}>{h === START ? '' : String(h).padStart(2, '0') + ':00'}</div>
            ))}
          </div>

          {days.map((d, di) => (
            <div key={d.name} style={{
              position: 'relative', height: colH, borderLeft: '1px solid var(--border)',
              background: d.today ? 'color-mix(in srgb, var(--accent-soft) 40%, transparent)' : 'transparent',
            }}>
              {hours.slice(1, -1).map((h) => (
                <div key={h} style={{ position: 'absolute', top: (h - START) * HOUR_H, left: 0, right: 0, borderTop: '1px solid var(--border)', opacity: 0.55 }}></div>
              ))}
              {blocks.filter((b) => b.day === di).map((b) => {
                const dragging = drag && drag.id === b.id;
                return (
                  <div key={b.id} style={blockStyle(b, dragging)} onMouseDown={(e) => startDrag(e, b)} title={b.l + ' · ' + fmtT(b.s) + '–' + fmtT(b.s + b.d)}>
                    {b.d >= 0.65 && <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.l}</div>}
                    {b.d >= 0.9 && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtT(b.s)}–{fmtT(b.s + b.d)}
                      </div>
                    )}
                  </div>
                );
              })}
              {d.today && (
                <div style={{ position: 'absolute', top: (NOW - START) * HOUR_H, left: 0, right: 0, zIndex: 4, pointerEvents: 'none' }}>
                  <div style={{ height: 2, background: 'var(--live)', boxShadow: '0 0 8px rgba(255,83,32,0.6)' }}></div>
                  <span style={{ position: 'absolute', left: -3, top: -4, width: 10, height: 10, borderRadius: '50%', background: 'var(--live)' }}></span>
                  <span style={{
                    position: 'absolute', right: 4, top: -9, padding: '1px 7px', borderRadius: 'var(--radius-pill)',
                    background: 'var(--live)', color: 'var(--live-contrast)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  }}>14:20</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '10px 0 14px', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: 'color-mix(in srgb, var(--project-2) 14%, var(--surface))', borderLeft: '3px solid var(--project-2)' }}></span> Gebucht</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--project-3)' }}></span> Meeting</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, border: '1.5px dashed var(--project-4)' }}></span> Vorschlag (Ghost)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 3px, transparent 3px 6px)', border: '1px dashed var(--border-strong)', boxSizing: 'border-box' }}></span> Pause (ArbZG §4)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--live)' }}></span> Jetzt</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>Blöcke ziehen — über Tage und Zeiten, 15-min-Raster</span>
      </div>
    </div>
  );
}
window.PlannerScreen = PlannerScreen;
