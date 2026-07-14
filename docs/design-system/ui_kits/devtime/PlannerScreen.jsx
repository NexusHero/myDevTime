function PlannerScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, Button, Tabs } = DS;
  const AIAskBar = DS.AIAskBar || (() => null);
  const [view, setView] = React.useState('week'); // week | month | year
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
    { id: 1, day: 0, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting', rec: true },
    { id: 2, day: 0, s: 9.5, d: 2.5, l: 'Finanzo API', c: 'var(--project-1)', k: 'actual' },
    { id: 3, day: 0, s: 13, d: 2, l: 'Sync engine', c: 'var(--project-2)', k: 'actual' },
    { id: 4, day: 0, s: 15.5, d: 1.5, l: 'Code review', c: 'var(--project-4)', k: 'actual' },
    { id: 5, day: 1, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting', rec: true },
    { id: 18, day: 0, s: 12.5, d: 0.5, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 19, day: 1, s: 12, d: 0.75, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 20, day: 2, s: 12.5, d: 0.5, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 21, day: 3, s: 12.5, d: 0.75, l: 'Pause', c: 'var(--ink-3)', k: 'break' },
    { id: 6, day: 1, s: 9.5, d: 1.5, l: 'Finanzo Review', c: 'var(--project-1)', k: 'actual' },
    { id: 7, day: 1, s: 13.25, d: 0.75, l: 'Nordwind Call', c: 'var(--project-3)', k: 'meeting', ext: 'Outlook' },
    { id: 8, day: 1, s: 13, d: 2, l: 'Deep work: Sync engine', c: 'var(--project-2)', k: 'ghost' },
    { id: 9, day: 1, s: 15.25, d: 0.75, l: 'Review backlog', c: 'var(--project-4)', k: 'ghost' },
    { id: 10, day: 2, s: 9, d: 2, l: 'Nordwind Sprint', c: 'var(--project-3)', k: 'actual' },
    // Überbuchung — Alltag: parallel zugesagt (voll), mit Vorbehalt (schraffiert), nur FYI (blass)
    { id: 30, day: 2, s: 10, d: 1, l: 'Arch Sync', c: 'var(--project-4)', k: 'meeting', rsvp: 'tentative', ext: 'Outlook' },
    { id: 31, day: 2, s: 10.25, d: 0.75, l: 'HR 1:1', c: 'var(--project-1)', k: 'meeting', rsvp: 'accepted', ext: 'Outlook' },
    { id: 11, day: 2, s: 11.5, d: 1, l: 'Pairing', c: 'var(--project-2)', k: 'meeting', rsvp: 'accepted' },
    { id: 32, day: 2, s: 14, d: 1.5, l: 'All-Hands', c: 'var(--project-3)', k: 'meeting', rsvp: 'fyi', ext: 'Outlook' },
    { id: 12, day: 2, s: 13.5, d: 3, l: 'Deep work', c: 'var(--project-2)', k: 'ghost' },
    { id: 13, day: 3, s: 9, d: 0.25, l: 'Standup', c: 'var(--project-1)', k: 'meeting', rec: true },
    { id: 14, day: 3, s: 10, d: 3, l: 'Finanzo API', c: 'var(--project-1)', k: 'ghost' },
    { id: 15, day: 3, s: 14, d: 1, l: 'Client call', c: 'var(--project-3)', k: 'meeting', rsvp: 'tentative', ext: 'Outlook' },
    { id: 16, day: 3, s: 15.5, d: 2, l: 'Sync engine', c: 'var(--project-2)', k: 'ghost' },
  ]);
  // All-Day-Zeile: Ganztägiges (Urlaub, Feiertag) liegt NICHT im Stundenraster
  const allDay = [{ day: 4, l: 'Urlaub', c: 'var(--neutral-400)' }];

  const NOW = 14.33;
  const GUTTER = 52;
  const GAP = 10; // Luft zwischen den Tages-Spuren (Lanes statt Tabelle)
  const SOLL_WEEK = 41.67; // 5 × 8:20h
  const WEEK_BOOKED = 40.6; // gebucht + geplant (siehe Header)
  const [conflict, setConflict] = React.useState('open'); // Demo: Outlook hat den Nordwind Call verschoben
  const [overflow, setOverflow] = React.useState(null);
  const [note, setNote] = React.useState(null);
  const [taskDrag, setTaskDrag] = React.useState(null); // Inbox-Task am Cursor
  const [hoverId, setHoverId] = React.useState(null); // Hover-Pop bei gequetschten Lanes
  const [slotHover, setSlotHover] = React.useState(null); // { day, s } — „+“-Ghost auf leeren Slots
  const [resize, setResize] = React.useState(null); // { id, y0, d0 } — Dauer per Unterkante
  React.useEffect(() => {
    if (!resize) return;
    const move = (e) => setBlocks((bs) => bs.map((b) => b.id === resize.id
      ? { ...b, d: Math.max(0.25, Math.min(END - b.s, Math.round((resize.d0 + (e.clientY - resize.y0) / HOUR_H) * 4) / 4)) }
      : b));
    const up = () => setResize(null);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [resize]);
  const pendingDragRef = React.useRef(null);
  const suppressClickRef = React.useRef(false);

  // ---- Task-Inbox: assigned Jira/Linear tickets land HERE, not in the
  //      calendar. Built for volume: search + filter + project groups +
  //      own scroll pane. "Planen" finds the next free slot and drops the
  //      ticket as a GHOST (proposal — you commit by leaving it). ----
  const [inboxOpen, setInboxOpen] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('Alle');
  const [srcFilter, setSrcFilter] = React.useState('Alle');
  const [sortBy, setSortBy] = React.useState('prio'); // prio | est | src
  const [openTask, setOpenTask] = React.useState(null); // key → Drill-in mit Beschreibung
  const PROJ = [
    { n: 'Finanzo AG', c: 'var(--project-1)' },
    { n: 'Sync engine', c: 'var(--project-2)' },
    { n: 'Nordwind GmbH', c: 'var(--project-3)' },
    { n: 'Atlas Relaunch', c: 'var(--project-4)' },
  ];
  const [tasks, setTasks] = React.useState([
    { key: 'FIN-231', t: 'SEPA-Export: Sammellastschrift', est: 2, prio: 1, tag: 'Feature', p: 0, due: '10.7.', dueIn: 2, src: 'Jira', desc: 'Sammellastschriften als SEPA-XML (pain.008) exportieren. Validierung gegen Schema, Mandatsreferenz prüfen.' },
    { key: 'FIN-228', t: 'Rundungsfehler Rechnungssumme', est: 1, prio: 1, tag: 'Bug', p: 0, due: '9.7.', dueIn: 1, src: 'Jira', desc: 'Bei 3+ Positionen mit 19%/7% MwSt weicht die Summe um 1 Cent ab. Rundung pro Position statt pro Rechnung.' },
    { key: 'FIN-224', t: 'Audit-Log für Buchungen', est: 3, prio: 2, tag: 'Feature', p: 0, src: 'Jira', desc: 'Jede Buchungsänderung revisionssicher loggen (wer, wann, was). Export für Wirtschaftsprüfer.' },
    { key: 'FIN-219', t: 'PR #412 reviewen', est: 0.5, prio: 2, tag: 'Review', p: 0, src: 'GitHub', desc: 'Refactoring des Invoice-Service — 400 Zeilen, 2 offene Kommentare vom Autor.' },
    { key: 'FIN-215', t: 'Mandanten-Import CSV', est: 2, prio: 3, tag: 'Feature', p: 0, src: 'Jira', desc: 'CSV-Import mit Spalten-Mapping-UI und Dubletten-Erkennung.' },
    { key: 'FIN-209', t: 'Flaky test: invoice.spec', est: 0.75, prio: 3, tag: 'Bug', p: 0, src: 'GitHub', desc: 'Schlägt ~1/20 Läufe fehl — vermutlich Race in der Test-Fixture.' },
    { key: 'SYNC-142', t: 'Conflict resolution: CRDT merge', est: 3, prio: 1, tag: 'Feature', p: 1, due: '11.7.', dueIn: 3, src: 'Linear', desc: 'Merge-Strategie für konkurrierende Edits: LWW-Register durch CRDT-Sequenz ersetzen.' },
    { key: 'SYNC-139', t: 'Offline-Queue läuft voll', est: 1.5, prio: 1, tag: 'Bug', p: 1, due: '9.7.', dueIn: 1, src: 'Linear', desc: 'Queue wächst unbegrenzt bei >2h offline. Kompaktierung + Obergrenze einziehen.' },
    { key: 'SYNC-137', t: 'Retry-Backoff konfigurierbar', est: 1, prio: 2, tag: 'Feature', p: 1, src: 'Linear', desc: 'Exponentielles Backoff mit Jitter, per Config übersteuerbar.' },
    { key: 'SYNC-133', t: 'PR #98 reviewen', est: 0.5, prio: 2, tag: 'Review', p: 1, src: 'GitHub', desc: 'Delta-Encoding für Sync-Payloads.' },
    { key: 'SYNC-128', t: 'Delta-Sync Telemetrie', est: 2, prio: 3, tag: 'Feature', p: 1, src: 'Linear', desc: 'Metriken: Payload-Größe, Merge-Dauer, Konfliktrate — als Dashboard.' },
    { key: 'NW-87', t: 'Login: SSO via Entra ID', est: 3, prio: 1, tag: 'Feature', p: 2, due: '17.7.', dueIn: 9, src: 'Jira', desc: 'OIDC-Flow gegen Entra ID, Gruppen-Mapping auf Rollen, Fallback lokaler Login.' },
    { key: 'NW-85', t: 'Report-PDF: Umlaute kaputt', est: 0.75, prio: 2, tag: 'Bug', p: 2, src: 'Jira', desc: 'Font-Subsetting verliert ä/ö/ü bei eingebetteten Schriften.' },
    { key: 'NW-82', t: 'Staging-Deploy reparieren', est: 1, prio: 2, tag: 'Bug', p: 2, src: 'GitHub', desc: 'Pipeline bricht beim Asset-Upload ab — S3-Credentials rotiert?' },
    { key: 'NW-79', t: 'PR #201 reviewen', est: 0.5, prio: 3, tag: 'Review', p: 2, src: 'GitHub', desc: 'Kleines Refactoring im Report-Modul.' },
    { key: 'NW-75', t: 'Dashboard-Widgets sortierbar', est: 2, prio: 3, tag: 'Feature', p: 2, src: 'Jira', desc: 'Drag-Sortierung + Persistenz pro Nutzer.' },
    { key: '#44', t: 'Hero-Section CMS-Anbindung', est: 2, prio: 2, tag: 'Feature', p: 3, src: 'GitHub', desc: 'Hero-Inhalte aus dem Headless-CMS statt hartkodiert.' },
    { key: '#41', t: 'Lighthouse: LCP > 4s mobil', est: 1.5, prio: 1, tag: 'Bug', p: 3, due: '10.7.', dueIn: 2, src: 'GitHub', desc: 'Hero-Bild unoptimiert, kein Preload. Ziel: LCP < 2,5s.' },
    { key: '#39', t: 'Navigation: Mega-Menu A11y', est: 1, prio: 2, tag: 'Bug', p: 3, src: 'GitHub', desc: 'Fokus-Falle + fehlende aria-expanded-Attribute.' },
    { key: '#36', t: 'PR #77 reviewen', est: 0.5, prio: 3, tag: 'Review', p: 3, src: 'GitHub', desc: 'Footer-Komponente vereinheitlicht.' },
    { key: '#33', t: 'Bildpipeline auf AVIF', est: 2, prio: 3, tag: 'Feature', p: 3, src: 'GitHub', desc: 'Build-Step: AVIF + WebP-Fallback generieren.' },
    { key: '#29', t: 'Cookie-Banner Consent-Mode', est: 1, prio: 3, tag: 'Feature', p: 3, src: 'GitHub', desc: 'Google Consent Mode v2 anbinden.' },
    { key: 'SYNC-121', t: 'Changelog-Generator', est: 1, prio: 3, tag: 'Feature', p: 1, src: 'Linear', desc: 'Aus Conventional Commits ein Changelog pro Release bauen.' },
    { key: 'FIN-201', t: 'Onboarding-Checkliste Steuerberater', est: 1.5, prio: 3, tag: 'Feature', p: 0, src: 'Jira', desc: 'Geführte Checkliste für neue StB-Mandate.' },
  ]);
  const nextIdRef = React.useRef(100);

  const findSlot = (est) => {
    for (let day = 1; day <= 4; day++) {
      const occ = blocks.filter((b) => b.day === day).map((b) => [b.s, b.s + b.d]).sort((a, b2) => a[0] - b2[0]);
      let s = day === 1 ? Math.ceil(NOW * 4) / 4 + 0.25 : START;
      while (s + est <= END) {
        const clash = occ.find(([a, e]) => s < e && s + est > a);
        if (!clash) return { day, s };
        s = Math.ceil(clash[1] * 4) / 4;
      }
    }
    return null;
  };

  // Kapazitäts-Ehrlichkeit: passt der Task nicht mehr ins Wochen-Soll,
  // wird NICHT stillschweigend gestopft — ehrliche Wahl statt Wunschliste.
  const planTask = (task, force) => {
    const slot = findSlot(task.est);
    if (!slot) { setOverflow(null); setNote('Kein freier Slot mehr in KW 28 — „' + task.key + '“ bleibt in der Inbox.'); return; }
    if (!force && WEEK_BOOKED + task.est > SOLL_WEEK) { setOverflow(task); return; }
    setBlocks((bs) => [...bs, { id: nextIdRef.current++, day: slot.day, s: slot.s, d: task.est, l: task.key + ' · ' + task.t, c: PROJ[task.p].c, k: 'ghost' }]);
    setTasks((ts) => ts.filter((x) => x.key !== task.key));
    setOverflow(null);
  };

  const prioDot = { 1: 'var(--bad)', 2: 'var(--warn)', 3: 'var(--ink-3)' };
  const sorters = {
    prio: (a, b) => a.prio - b.prio || b.est - a.est,
    due: (a, b) => (a.dueIn ?? 99) - (b.dueIn ?? 99) || a.prio - b.prio,
    est: (a, b) => b.est - a.est || a.prio - b.prio,
    src: (a, b) => a.src.localeCompare(b.src) || a.prio - b.prio,
  };
  const visibleTasks = tasks.filter((t) =>
    (tagFilter === 'Alle' || t.tag === tagFilter) &&
    (srcFilter === 'Alle' || t.src === srcFilter) &&
    (q === '' || (t.key + ' ' + t.t).toLowerCase().includes(q.toLowerCase()))
  ).sort(sorters[sortBy]);

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
      const colW = (rect.width - GUTTER - GAP * 5) / 5;
      const day = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left - GUTTER - GAP) / (colW + GAP))));
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

  // ---- Drag aus der Inbox in den Kalender (Motion/Sunsama-Geste):
  //      Task anfassen, über die Woche ziehen, loslassen → Ghost am 15-min-Raster ----
  React.useEffect(() => {
    const move = (e) => {
      const p = pendingDragRef.current;
      if (!p) return;
      if (!p.active) {
        if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 6) {
          p.active = true; suppressClickRef.current = true;
          setTaskDrag({ task: p.task, x: e.clientX, y: e.clientY });
        }
      } else {
        setTaskDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      }
    };
    const up = (e) => {
      const p = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!p || !p.active) return;
      setTaskDrag(null);
      const el = bodyRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (e.clientX > rect.left + GUTTER && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) {
          const t = p.task;
          const colW = (rect.width - GUTTER - GAP * 5) / 5;
          const day = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left - GUTTER - GAP) / (colW + GAP))));
          const s = Math.max(START, Math.min(END - t.est, Math.round((START + (e.clientY - rect.top) / HOUR_H) * 4) / 4));
          setBlocks((bs) => [...bs, { id: nextIdRef.current++, day, s, d: t.est, l: t.key + ' · ' + t.t, c: PROJ[t.p].c, k: 'ghost' }]);
          setTasks((ts) => ts.filter((x) => x.key !== t.key));
          window.dtToast && window.dtToast(t.key + ' eingeplant — ' + ['Mo', 'Di', 'Mi', 'Do', 'Fr'][day] + ' ' + String(Math.floor(s)).padStart(2, '0') + ':' + String(Math.round((s % 1) * 60)).padStart(2, '0'), () => { setBlocks((bs) => bs.filter((b) => b.l !== t.key + ' · ' + t.t)); setTasks((ts) => [...ts, t]); });
        }
      }
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  // Überbuchung: überlappende Blöcke teilen sich die Tagesspalte in Lanes
  const laneMap = React.useMemo(() => {
    const m = {};
    for (let day = 0; day < 5; day++) {
      const db = blocks.filter((b) => b.day === day).sort((a, b) => a.s - b.s || b.d - a.d);
      let cluster = [], clusterEnd = -1;
      const flush = () => {
        const lanes = [];
        cluster.forEach((b) => {
          let li = lanes.findIndex((end) => end <= b.s + 0.001);
          if (li === -1) { li = lanes.length; lanes.push(0); }
          lanes[li] = b.s + b.d;
          m[b.id] = { lane: li, of: 1 };
        });
        cluster.forEach((b) => { m[b.id].of = lanes.length; });
        cluster = [];
      };
      db.forEach((b) => {
        if (cluster.length && b.s >= clusterEnd - 0.001) { flush(); clusterEnd = -1; }
        cluster.push(b);
        clusterEnd = Math.max(clusterEnd, b.s + b.d);
      });
      if (cluster.length) flush();
    }
    return m;
  }, [blocks]);

  const blockStyle = (b, dragging, hovered) => {
    const tiny = b.d < 0.5;
    const ln = laneMap[b.id] || { lane: 0, of: 1 };
    const pop = hovered && ln.of > 1 && !dragging; // gequetschter Block klappt auf volle Breite auf
    const base = {
      position: 'absolute',
      left: pop || ln.of === 1 ? 4 : 'calc(4px + (100% - 8px) * ' + (ln.lane / ln.of) + ')',
      width: pop || ln.of === 1 ? 'calc(100% - 8px)' : 'calc((100% - 8px) / ' + ln.of + ' - 2px)',
      top: (b.s - START) * HOUR_H + 1,
      height: b.d * HOUR_H - 3,
      borderRadius: tiny ? 5 : 'var(--radius-block)',
      padding: tiny ? 0 : '5px 8px', overflow: 'hidden', boxSizing: 'border-box',
      fontSize: 'var(--fs-2xs)', lineHeight: 1.25,
      cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none',
      zIndex: dragging ? 10 : pop ? 8 : b.rsvp === 'fyi' ? 0 : 1,
      boxShadow: dragging || pop ? 'var(--shadow-lg)' : hovered ? 'var(--shadow-md, 0 2px 10px rgba(0,0,0,.10))' : 'none',
      transform: dragging ? 'scale(1.03)' : 'scale(1)',
      transition: dragging ? 'none' : 'top var(--dur-med) var(--ease-spring), left var(--dur-fast) var(--ease-out), width var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out)',
    };
    if (b.k === 'break') return { ...base, background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 5px, transparent 5px 10px)', border: '1px dashed var(--border-strong)', color: 'var(--ink-3)' };
    if (b.k === 'ghost') return { ...base, border: '1.5px dashed ' + b.c, background: dragging ? 'var(--surface)' : 'transparent', color: 'var(--ink-2)' };
    if (b.k === 'meeting') {
      if (b.rsvp === 'tentative') return { ...base, background: 'repeating-linear-gradient(135deg, color-mix(in srgb, ' + b.c + ' 22%, var(--surface)) 0 5px, var(--surface) 5px 10px)', border: '1.5px solid ' + b.c, color: 'var(--ink)' };
      if (b.rsvp === 'fyi') return { ...base, border: '1px dotted var(--border-strong)', background: 'var(--surface-sunk)', color: 'var(--ink-3)', zIndex: 0 };
      return { ...base, background: b.c, color: '#fff' };
    }
    // Task/Gebucht: sattere Tönung + Hover sättigt weiter auf — lebendig in der Interaktion
    const tint = hovered || dragging ? 30 : 21;
    return { ...base, background: 'color-mix(in srgb, ' + b.c + ' ' + tint + '%, var(--surface))', borderLeft: '4px solid ' + b.c, color: 'var(--ink)' };
  };

  const fmtT = (h) => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');
  // Warmes Grundrauschen: Hauch Ember-Orange (--live) im Raster — --accent ist im Default-Theme blau
  const WARM = 'color-mix(in srgb, var(--live) 2.5%, var(--surface))';

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap', rowGap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1, minWidth: 160 }}>Planner</div>
        <span style={{ flexShrink: 0 }}>
          <Tabs items={[{ value: 'week', label: 'Woche' }, { value: 'month', label: 'Monat' }, { value: 'year', label: 'Jahr' }]} active={view} onChange={setView} />
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 6px', background: 'var(--surface)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 8px' }}>‹</button>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)' }}>{view === 'week' ? 'KW 28' : view === 'month' ? 'Juli 2026' : '2026'}</span>
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

      {/* Replan-Flow: Konflikt erkannt → KI legt neu, als Ghosts */}
      {conflict === 'open' && view === 'week' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-lg)', border: '1px solid var(--live-border)', background: 'var(--live-soft)', fontSize: 'var(--fs-2xs)', color: 'var(--ink)', flexWrap: 'wrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--live)', flexShrink: 0 }}></span>
          <span><b>Konflikt:</b> „Nordwind Call“ (Outlook) wurde auf 13:15 verschoben — kollidiert mit „Deep work: Sync engine“.</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => { setBlocks((bs) => bs.map((b) => b.id === 8 ? { ...b, s: 14.5 } : b.id === 9 ? { ...b, s: 16.5 } : b)); setConflict('done'); }}>✦ Woche neu legen</Button>
            <Button size="sm" variant="ghost" onClick={() => setConflict(null)}>Ignorieren</Button>
          </span>
        </div>
      )}
      {conflict === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 12, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'color-mix(in srgb, var(--good) 8%, var(--surface))', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>
          ✦ 2 Blöcke neu gelegt — als Ghost-Vorschlag. Passt es, lass sie einfach stehen.
          <button onClick={() => setConflict(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13 }}>×</button>
        </div>
      )}
      {/* Kapazitäts-Ehrlichkeit: Woche voll → ehrliche Wahl */}
      {overflow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-lg)', border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)', background: 'color-mix(in srgb, var(--warn) 10%, var(--surface))', fontSize: 'var(--fs-2xs)', color: 'var(--ink)', flexWrap: 'wrap' }}>
          <span><b>Woche voll:</b> „{overflow.key}“ ({overflow.est}h) sprengt das Soll — 40,6h geplant + {overflow.est}h &gt; 41:40h.</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => { const k = overflow.key; setTasks((ts) => ts.filter((x) => x.key !== k)); setOverflow(null); setNote('„' + k + '“ für KW 29 vorgemerkt — taucht dort als Vorschlag auf.'); }}>→ KW 29 planen</Button>
            <Button size="sm" variant="ghost" onClick={() => planTask(overflow, true)}>Trotzdem planen</Button>
            <Button size="sm" variant="ghost" onClick={() => setOverflow(null)}>Abbrechen</Button>
          </span>
        </div>
      )}
      {note && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 12, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>
          ✦ {note}
          <button onClick={() => setNote(null)} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13 }}>×</button>
        </div>
      )}

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
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 6 }}>
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
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginRight: 2 }}>Sortieren</span>
                {[['prio', 'Priorität'], ['due', 'Deadline'], ['est', 'Aufwand'], ['src', 'Quelle']].map(([id, label]) => (
                  <button key={id} onClick={() => setSortBy(id)} style={{
                    padding: '3px 9px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 10, fontWeight: 700,
                    border: sortBy === id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                    background: sortBy === id ? 'var(--accent-soft)' : 'var(--surface)',
                    color: sortBy === id ? 'var(--accent-strong)' : 'var(--ink-2)',
                  }}>{label}</button>
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
                      <div key={t.key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 6px', borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}
                        onMouseDown={(e) => { if (e.target.tagName === 'BUTTON') return; pendingDragRef.current = { x: e.clientX, y: e.clientY, task: t, active: false }; }}
                        onClick={() => { if (suppressClickRef.current) return; setOpenTask(openTask === t.key ? null : t.key); }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunk)'; e.currentTarget.querySelectorAll('button').forEach((x) => { x.style.opacity = 1; }); }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelectorAll('button').forEach((x) => { x.style.opacity = 0; }); }}>
                        {/* Abhaken — ein Klick, fertig. Kein Zustands-Zirkus. */}
                        <button onClick={(e) => { e.stopPropagation(); setTasks((ts) => ts.filter((x) => x.key !== t.key)); }} title="Erledigt" style={{ opacity: 0, transition: 'opacity var(--dur-fast) var(--ease-out)', width: 15, height: 15, borderRadius: 5, border: '1.5px solid var(--border-strong)', background: 'var(--surface)', cursor: 'pointer', flexShrink: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'transparent', fontSize: 9, fontWeight: 800 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--good)'; e.currentTarget.style.borderColor = 'var(--good)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'transparent'; }}>✓</button>
                        <span title={'Priorität P' + t.prio} style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 800, color: t.prio === 1 ? '#fff' : 'var(--ink-2)', background: t.prio === 1 ? 'var(--bad)' : 'var(--surface-sunk)', border: t.prio === 1 ? 'none' : '1px solid var(--border)', borderRadius: 4, padding: '1px 4px', flexShrink: 0, boxSizing: 'border-box' }}>P{t.prio}</span>
                        <span title={t.src} style={{ width: 15, height: 15, borderRadius: 4, background: 'var(--surface-sunk)', border: '1px solid var(--border)', boxSizing: 'border-box', color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 800, fontFamily: 'var(--font-display)', flexShrink: 0 }}>{t.src[0]}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>{t.key}</span>
                            <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.t}</span>
                            {t.due && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, flexShrink: 0, color: t.dueIn <= 2 ? 'var(--bad)' : t.dueIn <= 5 ? 'var(--warn)' : 'var(--ink-3)' }}>▸ {t.due}</span>}
                          </div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{t.est}h</span>
                        <button onClick={(e) => { e.stopPropagation(); planTask(t); }} style={{ opacity: 0, transition: 'opacity var(--dur-fast) var(--ease-out)', border: 'none', borderRadius: 'var(--radius-pill)', padding: '3px 9px', fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>✦ Planen</button>
                      </div>
                      {openTask === t.key && (
                        <div style={{ margin: '0 6px 6px 6px', padding: '8px 10px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunk)', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', lineHeight: 1.5 }}>{t.desc}</div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                            <span>P{t.prio}</span><span>{t.est}h geschätzt</span>{t.due && <span>fällig {t.due}</span>}<span>{t.tag}</span><span>{t.src}</span>
                          </div>
                        </div>
                      )}
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
              <span>✓ hakt ab · Task antippen → Beschreibung · „✦ Planen“ legt einen Ghost in den nächsten freien Slot</span>
            </div>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingBottom: 8 }}>
      {view === 'month' && <Card padding={false}><window.PlannerMonth onDrill={() => setView('week')} /></Card>}
      {view === 'year' && <window.PlannerYear onDrill={() => setView('month')} />}
      {view === 'week' && (
      <Card padding={false}>
        <style>{'@keyframes dt-block-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } } @media (prefers-reduced-motion: reduce) { .dt-block { animation: none !important; } }'}</style>
        <div style={{ padding: '12px 12px 14px', background: WARM, borderRadius: 'inherit' }}>
        {/* Tagesköpfe als Pills — kein Tabellen-Header */}
        <div style={{ display: 'grid', gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)', columnGap: GAP, marginBottom: 6 }}>
          <div></div>
          {days.map((d, di) => {
            // Überbuchungs-Hinweis: zählt echte Konflikte (FYI & Pausen zählen nicht)
            const real = blocks.filter((b) => b.day === di && b.k !== 'break' && b.rsvp !== 'fyi');
            const clash = real.some((a) => real.some((b) => a.id < b.id && a.s < b.s + b.d && b.s < a.s + a.d));
            return (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, padding: '2px 2px 6px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, padding: '3px 11px', borderRadius: 'var(--radius-pill)', background: d.today ? 'var(--accent)' : 'transparent', color: d.today ? 'var(--accent-contrast, #fff)' : 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-sm)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {d.name} <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 500, opacity: d.today ? 0.85 : 0.55 }}>{d.date}</span>
              </span>
              {clash && <span title="Überbucht — zwei aktive Zusagen überlappen" style={{ fontSize: 9, fontWeight: 800, color: 'var(--warn)', background: 'var(--warn-soft)', borderRadius: 'var(--radius-pill)', padding: '1px 7px', whiteSpace: 'nowrap' }}>2×</span>}
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{d.total}</span>
            </div>
            );
          })}
        </div>

        {/* All-Day-Zeile: Urlaub/Feiertage als Banner, nicht als Stundenblock */}
        <div style={{ display: 'grid', gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)', columnGap: GAP, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)' }}>ganzt.</div>
          {days.map((d, di) => {
            const ad = allDay.find((a) => a.day === di);
            return (
              <div key={d.name} style={{ minHeight: 24, boxSizing: 'border-box' }}>
                {ad && <span style={{ display: 'block', borderRadius: 7, padding: '3px 9px', fontSize: 10, fontWeight: 700, background: 'color-mix(in srgb, ' + ad.c + ' 18%, var(--surface))', border: '1px solid color-mix(in srgb, ' + ad.c + ' 40%, transparent)', color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>◦ {ad.l}</span>}
              </div>
            );
          })}
        </div>

        {/* body grid — drag surface: jeder Tag eine abgesenkte, runde Spur */}
        <div ref={bodyRef} style={{ display: 'grid', gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)', columnGap: GAP }}>
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
              position: 'relative', height: colH, borderRadius: 12,
              background: d.today ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'color-mix(in srgb, var(--live) 2%, var(--surface-sunk))',
            }}>
              {hours.slice(1, -1).map((h) => (
                <div key={h} style={{ position: 'absolute', top: (h - START) * HOUR_H, left: 6, right: 6, borderTop: '1px solid var(--border)', opacity: 0.4 }}></div>
              ))}
              {/* 30-min-Hairlines — präziseres Raster fürs 15-min-Snapping */}
              {hours.slice(0, -1).map((h) => (
                <div key={'half' + h} style={{ position: 'absolute', top: (h - START + 0.5) * HOUR_H, left: 6, right: 6, borderTop: '1px dotted var(--border)', opacity: 0.25 }}></div>
              ))}
              {/* Vergangenheit gedimmt — die Zeit läuft sichtbar nach vorn */}
              {d.today && <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: (NOW - START) * HOUR_H, background: 'color-mix(in srgb, var(--surface) 45%, transparent)', zIndex: 2, pointerEvents: 'none', borderRadius: '12px 12px 0 0' }}></div>}
              {/* „+“-Ghost auf leerem Slot — Klick legt Eintrag an */}
              {!drag && !resize && !taskDrag && (
                <div style={{ position: 'absolute', inset: 0 }}
                  onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const s = Math.max(START, Math.min(END - 0.5, Math.floor((START + (e.clientY - r.top) / HOUR_H) * 2) / 2)); const free = !blocks.some((b) => b.day === di && s < b.s + b.d && s + 0.5 > b.s); setSlotHover(free ? { day: di, s } : null); }}
                  onMouseLeave={() => setSlotHover(null)}
                  onClick={() => { if (!slotHover || slotHover.day !== di) return; const s = slotHover.s; setBlocks((bs) => [...bs, { id: nextIdRef.current++, day: di, s, d: 1, l: 'Neuer Eintrag', c: 'var(--project-2)', k: 'actual' }]); window.dtToast && window.dtToast('Eintrag angelegt — ' + fmtT(s) + '–' + fmtT(s + 1), () => setBlocks((bs) => bs.slice(0, -1))); setSlotHover(null); }}>
                  {slotHover && slotHover.day === di && (
                    <div style={{ position: 'absolute', top: (slotHover.s - START) * HOUR_H + 1, left: 4, right: 4, height: HOUR_H - 3, borderRadius: 'var(--radius-block)', border: '1.5px dashed var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--accent)', fontSize: 'var(--fs-2xs)', fontWeight: 700, cursor: 'copy' }}>+ {fmtT(slotHover.s)}</div>
                  )}
                </div>
              )}
              {blocks.filter((b) => b.day === di).map((b) => {
                const dragging = drag && drag.id === b.id;
                return (
                  <div key={b.id} className="dt-block" style={{ ...blockStyle(b, dragging, hoverId === b.id), animation: 'dt-block-in var(--dur-med) var(--ease-spring) backwards' }} onMouseDown={(e) => startDrag(e, b)} onMouseEnter={() => setHoverId(b.id)} onMouseLeave={() => setHoverId(null)} title={b.l + ' · ' + fmtT(b.s) + '–' + fmtT(b.s + b.d)}>
                    {/* Drag/Resize-Feedback: Ziel-Zeit live am Block */}
                    {(dragging || (resize && resize.id === b.id)) && (
                      <span style={{ position: 'absolute', top: -22, left: 4, zIndex: 12, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--ink)', color: 'var(--bg)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-lg)' }}>{fmtT(b.s)}–{fmtT(b.s + b.d)}</span>
                    )}
                    {b.d >= 0.65 && <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.rec && <span title="Wiederkehrend" style={{ opacity: 0.7, marginRight: 3 }}>↻</span>}{b.ext && <span title={'Aus ' + b.ext + ' synchronisiert (Microsoft Graph) — ⇄ zwei-Wege: DevTime schreibt Fokuszeit zurück'} style={{ fontSize: 8, fontWeight: 800, border: '1px solid currentColor', borderRadius: 3, padding: '0 3px', marginRight: 4, opacity: 0.85 }}>⇄ OL</span>}{b.rsvp === 'tentative' && <span title="Mit Vorbehalt zugesagt" style={{ fontSize: 8, fontWeight: 800, border: '1px solid currentColor', borderRadius: 3, padding: '0 3px', marginRight: 4, opacity: 0.85 }}>?</span>}{b.rsvp === 'fyi' && <span title="Nur zur Info — keine Teilnahme, zählt nicht als Arbeitszeit" style={{ fontSize: 8, fontWeight: 800, border: '1px dotted currentColor', borderRadius: 3, padding: '0 3px', marginRight: 4, opacity: 0.85 }}>FYI</span>}{b.l}</div>}
                    {b.d >= 0.9 && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtT(b.s)}–{fmtT(b.s + b.d)}
                      </div>
                    )}
                    {/* Resize-Handle: Dauer per Unterkante ziehen (15-min-Raster) */}
                    {b.k !== 'break' && <div onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setResize({ id: b.id, y0: e.clientY, d0: b.d }); }} title="Dauer ändern" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 7, cursor: 'ns-resize' }}></div>}
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
        </div>
      </Card>
      )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, padding: '10px 0 14px', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: 'color-mix(in srgb, var(--project-2) 21%, var(--surface))', borderLeft: '4px solid var(--project-2)' }}></span> Task / Gebucht</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: 'var(--project-3)' }}></span> Meeting</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, border: '1.5px dashed var(--project-4)' }}></span> Vorschlag (Ghost)</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontStyle: 'italic', color: 'var(--project-11, #7c6cf3)' }}><span style={{ width: 14, height: 10, borderRadius: 3, border: '1px dashed var(--project-11, #7c6cf3)', boxSizing: 'border-box' }}></span> Event — zählt nicht, blockiert nicht</span>
        {view === 'week' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 2, background: 'var(--live)' }}></span> Jetzt</span>}
        {view === 'month' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--warn)' }}></span> Tag-Schwere (prio-gewichtet vs. Soll)</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>{view === 'week' ? 'Blöcke & Inbox-Tasks ziehen · 15-min-Raster · ↻ wiederkehrend · OL = Outlook · ? = Vorbehalt · FYI = ohne Teilnahme · überlappende Blöcke teilen sich die Spalte' : view === 'month' ? 'Tag anklicken → Woche' : 'Monat anklicken → Monat'}</span>
      </div>
      {/* Floating-Chip beim Ziehen aus der Inbox */}
      {taskDrag && (
        <div style={{ position: 'fixed', left: taskDrag.x + 10, top: taskDrag.y + 8, zIndex: 100, pointerEvents: 'none', padding: '6px 10px', borderRadius: 'var(--radius-lg)', border: '1.5px dashed ' + PROJ[taskDrag.task.p].c, background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink)' }}>
          {taskDrag.task.key} · {taskDrag.task.est}h
        </div>
      )}
    </div>
  );
}
window.PlannerScreen = PlannerScreen;
