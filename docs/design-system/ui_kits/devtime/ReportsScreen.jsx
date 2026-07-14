function useCountUp(target, duration = 700) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Donut — SVG stroke segments, center = total. Every figure clickable in the
// real product (auditability as UX); here the legend carries the numbers.
function ProjectDonut({ data, total }) {
  const R = 56, C = 2 * Math.PI * R;
  let acc = 0;
  const sum = data.reduce((s, d) => s + d.h, 0);
  const [drawn, setDrawn] = React.useState(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  React.useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
        <svg viewBox="0 0 150 150" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
          {data.map((d, i) => {
            const frac = drawn ? d.h / sum : 0;
            const seg = (
              <circle key={d.n} cx="75" cy="75" r={R} fill="none" stroke={d.c} strokeWidth="16"
                strokeDasharray={Math.max(frac * C - 3, 0.01) + ' ' + (C - frac * C + 3)}
                strokeDashoffset={-acc * C}
                style={{ transition: 'stroke-dasharray var(--dur-slow) var(--ease-out) ' + i * 130 + 'ms, stroke-dashoffset var(--dur-slow) var(--ease-out) ' + i * 130 + 'ms' }} />
            );
            acc += frac;
            return seg;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <span style={{ fontSize: 9, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', fontWeight: 700 }}>gearbeitet</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d) => (
          <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: d.c, flexShrink: 0 }}></span>
            <span style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--ink)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{d.h}h</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', width: 34, textAlign: 'right' }}>{Math.round((d.h / data.reduce((s, x) => s + x.h, 0)) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, StatTile, BoxPlot, Heatmap, WeekSparkline, Tabs, Button } = DS;
  const AIAskBar = DS.AIAskBar || (() => null);
  const LoadMeter = DS.LoadMeter || (() => null);
  const CheckinCard = DS.CheckinCard || (() => null);
  const [checkedIn, setCheckedIn] = React.useState(false);
  const AICallout = DS.AICallout || (({ title, children, action }) => (
    <div style={{ padding: '10px 14px', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-card)', display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>{title && <b style={{ color: 'var(--ink)' }}>{title} </b>}{children}</div>{action}
    </div>
  ));
  const [range, setRange] = React.useState('week');
  const [selDay, setSelDay] = React.useState(9); // index in month grid — 'heute'

  // Every figure from the deterministic core — the view only formats.
  const DATA = {
    week: {
      label: 'KW 28', worked: 41.25, workedLabel: '41:15h', billablePct: 79, revenue: '2.540 €', overtime: '+1:30h', overtimeH: 1.5,
      donut: [
        { n: 'Finanzo AG', h: 14.5, c: 'var(--project-1)' },
        { n: 'Sync engine', h: 12.3, c: 'var(--project-2)' },
        { n: 'Nordwind GmbH', h: 8.2, c: 'var(--project-3)' },
        { n: 'Atlas Relaunch', h: 6.3, c: 'var(--project-4)' },
      ],
      burn: { pts: '0,42 30,46 60,52 90,56 120,61 150,66', win: 'Run-Rate dieser Woche (ø 1,6h/Tag)', tasks: [[2, 1], [1, 2], [1, 1], [1, 0]], neu: 5, zu: 4, fazit: 'diese Woche fast im Gleichgewicht.' },
    },
    month: {
      label: 'Juli 2026', worked: 168, workedLabel: '168:20h', billablePct: 78, revenue: '10.940 €', overtime: '+4:30h', overtimeH: 4.5,
      donut: [
        { n: 'Finanzo AG', h: 58, c: 'var(--project-1)' },
        { n: 'Sync engine', h: 46, c: 'var(--project-2)' },
        { n: 'Nordwind GmbH', h: 38, c: 'var(--project-3)' },
        { n: 'Atlas Relaunch', h: 26, c: 'var(--project-4)' },
      ],
      burn: { pts: '0,10 30,16 60,28 90,34 120,52 150,66', win: 'Run-Rate der letzten 14 Tage (ø 1,9h/Tag)', tasks: [[5, 4], [3, 4], [4, 3], [2, 3]], neu: 14, zu: 11, fazit: 'der Backlog wächst schneller als das Budget.' },
    },
    year: {
      label: '2026', worked: 1642, workedLabel: '1.642h', billablePct: 73, revenue: '94.800 €', overtime: '+9:30h', overtimeH: 9.5,
      donut: [
        { n: 'Finanzo AG', h: 612, c: 'var(--project-1)' },
        { n: 'Nordwind GmbH', h: 388, c: 'var(--project-3)' },
        { n: 'Sync engine', h: 296, c: 'var(--project-2)' },
        { n: 'Atlas Relaunch', h: 214, c: 'var(--project-4)' },
        { n: 'Intern & Sonstige', h: 132, c: 'var(--project-11)' },
      ],
      burn: { pts: '0,4 30,10 60,20 90,32 120,50 150,66', win: 'Verlauf seit Projektstart (Feb 2026)', tasks: [[9, 7], [11, 10], [8, 9], [6, 5]], neu: 34, zu: 31, fazit: 'übers Jahr stabil — der Engpass ist das Stundenbudget, nicht der Backlog.' },
    },
  };
  const d = DATA[range];
  const worked = useCountUp(d.worked);
  const fmtWorked = range === 'year' ? Math.round(worked).toLocaleString('de-DE') + 'h' : Math.floor(worked) + ':' + String(Math.round((worked % 1) * 60)).padStart(2, '0') + 'h';

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1 }}>Reports</div>
        <Button size="sm" variant="ghost">{range === 'year' ? 'Jahresbericht' : 'Monatsbericht'} exportieren</Button>
      </div>
      <Tabs items={[{ value: 'week', label: 'Woche' }, { value: 'month', label: 'Monat' }, { value: 'year', label: 'Jahr' }]} active={range} onChange={setRange} />

      {/* Arbeitsfläche — einziger Scrollbereich; Titel + Tabs stehen fest.
           key={range}: beim Range-Wechsel steigen die Sektionen gestaffelt neu ein. */}
      <div key={range} style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -28px', padding: '0 28px 28px' }}>
      <style>{'@keyframes dt-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } } .dt-rise { animation: dt-rise var(--dur-slow) var(--ease-out) both; } @keyframes dt-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } } .dt-draw { animation: dt-draw 900ms var(--ease-out) both 150ms; } @keyframes dt-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } } .dt-grow { transform-box: fill-box; transform-origin: bottom; animation: dt-grow var(--dur-slow) var(--ease-spring) both; } @keyframes dt-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } } .dt-pop { transform-box: fill-box; transform-origin: center; animation: dt-pop var(--dur-med) var(--ease-spring) both; } @media (prefers-reduced-motion: reduce) { .dt-rise, .dt-draw, .dt-grow, .dt-pop { animation: none; } }'}</style>
      {/* AI reachable in context */}
      <div style={{ margin: '16px 0 0', maxWidth: 680 }}>
        <AIAskBar
          scopes={['Projekte', 'Umsatz', 'Saldo']}
          answers={{
            'Welches Projekt frisst mein Budget?': 'Nordwind: 91% des 80h-Budgets verbraucht, Run-Rate 1,9h/Tag — erschöpft ~21.7. Alle anderen Projekte liegen unter 65%.',
            'Wie stehe ich beim Überstunden-Saldo?': '+9:30h Jahressaldo. Dein Median-Tag liegt bei 8:24h, 4 Minuten über Soll — der Saldo wächst also langsam weiter.',
          }}
        />
      </div>

      {/* The story in one row: how much · how much of it paid · what it earned · balance */}
      <div className="dt-rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12, marginTop: 20 }}>
        <StatTile label={'Gearbeitet · ' + d.label} value={fmtWorked} />
        <StatTile label="Billable-Quote" value={d.billablePct + '%'} delta={range === 'week' ? 4 : 2} />
        <StatTile label="Umsatz" value={d.revenue.replace(' ', '\u00A0')} delta={range === 'year' ? 18 : 6} />
        <StatTile label="Saldo" value={d.overtime} />
      </div>

      {/* ---- Balance: strain made visible — deterministic signals + AI recovery proposal ---- */}
      <div className="dt-rise" style={{ marginTop: 12, animationDelay: '60ms' }}>
        <Card title="Balance" subtitle={d.label + ' · Belastung aus deinen eigenen Daten — keine Diagnose'}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <LoadMeter score={range === 'week' ? 64 : range === 'month' ? 55 : 47} width={300} />
              {/* Trend, not snapshot — burnout is a process (weeks), never a day's mood */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 6 }}>Verlauf · 10 Wochen</div>
                <svg viewBox="0 0 300 56" style={{ width: '100%', maxWidth: 300, display: 'block' }}>
                  <line x1="0" y1="25" x2="300" y2="25" stroke="var(--warn)" strokeWidth="1" strokeDasharray="3 4" opacity="0.55" />
                  <text x="298" y="20" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8" fill="var(--ink-3)">erhöht</text>
                  <polyline className="dt-draw" pathLength="1" strokeDasharray="1" style={{ animationDuration: '1100ms' }} points="0,44 33,46 66,41 99,43 132,38 165,40 198,34 231,30 264,26 297,21" fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {[[0,44],[33,46],[66,41],[99,43],[132,38],[165,40],[198,34],[231,30],[264,26]].map(([cx, cy], i) => (
                    <circle key={i} className="dt-pop" style={{ animationDelay: 150 + i * 95 + 'ms' }} cx={cx} cy={cy} r="2.5" fill="var(--surface)" stroke="var(--warn)" strokeWidth="1.5" />
                  ))}
                  <circle className="dt-pop" style={{ animationDelay: '1050ms' }} cx="297" cy="21" r="4" fill="var(--warn)" />
                  {/* self-report markers: check-in weeks */}
                  {[33, 99, 165, 231, 297].map((cx, i) => (
                    <rect key={cx} className="dt-pop" style={{ animationDelay: 400 + i * 90 + 'ms' }} x={cx - 2} y="50" width="4" height="4" rx="1" fill="var(--accent)" opacity="0.7" />
                  ))}
                </svg>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>Linie = passive Signale · <span style={{ color: 'var(--accent)' }}>▪</span> = deine Check-ins</div>
              </div>
            </div>
            <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['warn', '3. Woche in Folge über Soll', '+1:30h · +2:10h · +1:05h'],
                ['warn', '2× Pause übersprungen', 'Di · Do'],
                ['warn', 'Erholungsfenster schrumpft', 'ø 12:10h zwischen Feierabend & Start'],
                ['good', 'Keine Abend-Sessions', 'letzte nach 20 Uhr: vor 9 Tagen'],
                ['good', 'Meeting-Anteil gesund', '22% — unter deinem 30%-Limit'],
              ].map(([tone, label, detail]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone === 'warn' ? 'var(--warn)' : 'var(--good)', flexShrink: 0 }}></span>
                  <span style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{detail}</span>
                </div>
              ))}
              {/* Weekly self-report — the honest half of the signal */}
              <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Wochen-Check-in</div>
                <CheckinCard compact onDone={() => setCheckedIn(true)} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <AICallout
              compact
              title={checkedIn ? 'Dein Check-in bestätigt die Daten.' : 'Deine Belastung steigt seit drei Wochen.'}
              action={<React.Fragment><Button size="sm">✦ In Planner übernehmen</Button><Button size="sm" variant="ghost">Später</Button></React.Fragment>}
            >
              {checkedIn
                ? 'Du meldest Erschöpfung 4/5 — und die passiven Signale zeigen die dritte Woche über Soll, das passt zusammen. Vorschlag: Donnerstag meetingfrei, Feierabend-Ghost 17:30, Reviews auf Freitagvormittag.'
                : 'Vorschlag für nächste Woche: Donnerstag meetingfrei halten, Feierabend-Ghost um 17:30 setzen und die zwei Review-Blöcke auf Freitagvormittag ziehen — das bringt dich rechnerisch zurück auf Soll.'}
            </AICallout>
          </div>
        </Card>
      </div>

      <div className="dt-rise" style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', animationDelay: '120ms' }}>
        {/* Where the time went — the pie */}
        <Card title="Wohin ging die Zeit?" subtitle={d.label + ' · nach Projekt'} style={{ flex: '1.3 1 340px', minWidth: 0 }}>
          <ProjectDonut data={d.donut} total={d.workedLabel} />
        </Card>

        <Card title="Budget burn-down" subtitle="Nordwind GmbH · 80h fixed" action={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--warn)', background: 'var(--warn-soft)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontVariantNumeric: 'tabular-nums' }}>erschöpft ~21.7.</span>} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <svg viewBox="0 0 300 110" style={{ width: '100%', display: 'block' }}>
            <line x1="0" y1="100" x2="300" y2="100" stroke="var(--border)" strokeWidth="1" />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} x1="0" y1={10 + i * 30} x2="300" y2={10 + i * 30} stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
            ))}
            <style>{'@media (prefers-reduced-motion: reduce) { .dt-draw { animation: none !important; stroke-dashoffset: 0 !important; } }'}</style>
            <polyline className="dt-draw" points={d.burn.pts} fill="none" stroke="var(--project-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" style={{ animation: 'dt-draw 900ms var(--ease-out) both 150ms' }} />
            <polyline className="dt-draw" points="150,66 210,84 258,100" fill="none" stroke="var(--project-3)" strokeWidth="2" strokeDasharray="5 5" opacity="0.55" style={{ animation: 'none' }} />
            <circle className="dt-pop" style={{ animationDelay: '950ms' }} cx="150" cy="66" r="4" fill="var(--live)" />
            <text x="4" y="24" fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-3)">80h</text>
            <text x="130" y="108" fontFamily="var(--font-mono)" fontSize="9" fill="var(--live)">heute</text>
            <text x="248" y="94" fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-3)">21.7.</text>
          </svg>
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 8 }}>
            {d.burn.win} — Fenster + Rate sichtbar, keine falsche Präzision.
          </div>
          {/* Tasks under the budget: opened vs. closed per week */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <svg viewBox="0 0 120 40" style={{ width: 120, flexShrink: 0 }}>
              {d.burn.tasks.map(([neu, zu], w) => (
                <g key={w} transform={'translate(' + (w * 30 + 4) + ',0)'}>
                  <rect className="dt-grow" style={{ animationDelay: 200 + w * 90 + 'ms' }} x="0" y={36 - Math.min(neu, 11) * 3} width="8" height={Math.min(neu, 11) * 3} rx="2" fill="var(--accent)" opacity="0.85" />
                  <rect className="dt-grow" style={{ animationDelay: 245 + w * 90 + 'ms' }} x="11" y={36 - Math.min(zu, 11) * 3} width="8" height={Math.min(zu, 11) * 3} rx="2" fill="var(--good)" opacity="0.85" />
                </g>
              ))}
            </svg>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{d.burn.neu}</b> <span style={{ color: 'var(--accent)' }}>■</span> neue Aufgaben · <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{d.burn.zu}</b> <span style={{ color: 'var(--good)' }}>■</span> geschlossen — {d.burn.fazit}
            </div>
          </div>
        </Card>
      </div>

      <div className="dt-rise" style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap', animationDelay: '180ms' }}>
        <Card title="Tagesarbeitszeit" subtitle={d.label + ' · Verteilung vs. Soll 8:20h'} action={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--good)', background: 'var(--good-soft)', padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontVariantNumeric: 'tabular-nums' }}>Saldo {d.overtime}</span>} style={{ flex: '1 1 300px', minWidth: 0 }}>
          <BoxPlot
            min={range === 'year' ? 5.5 : 6.2} q1={range === 'year' ? 7.4 : 7.5} median={range === 'year' ? 8.3 : 8.4}
            q3={range === 'year' ? 9.0 : 9.2} max={range === 'year' ? 11.5 : 10.75} target={8.33} width={320} />
          <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 4 }}>
            Die Box ist dein typischer Tag (25–75%), der Strich der Median, orange das Soll — liegt die Box rechts davon, baust du Überstunden auf.
          </div>
        </Card>
        {range === 'week' && (
          <Card title="Fokus-Stunden" subtitle="Täglich, diese Woche" style={{ flex: '1 1 300px', minWidth: 0 }}>
            <WeekSparkline values={[6, 7.5, 8, 5, 7, 2, 0]} />
          </Card>
        )}
        {range === 'month' && (
          <Card title="Monatsübersicht" subtitle="Juli 2026 · Tag antippen für Einträge" style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, maxWidth: 260 }}>
              {[null, null, 1, 2, 3, 0, 0, 2, 3, 'now', -1, 0, 0, 0, 1, 2, 2, 3, 1, 0, 0, 2, 1, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0].map((v, i) => (
                <button key={i} disabled={v === null} onClick={() => setSelDay(i)} style={{
                  aspectRatio: '1', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: v === null ? 'transparent' : v === 'now' ? 'var(--live)' : 'var(--surface-sunk)',
                  border: v === -1 ? '1.5px dashed var(--warn)' : selDay === i ? '2px solid var(--accent)' : '2px solid transparent',
                  boxSizing: 'border-box', cursor: v === null ? 'default' : 'pointer', padding: 0,
                }}>
                  {typeof v === 'number' && v > 0 && (
                    <span style={{ width: 4 + v * 1.5, height: 4 + v * 1.5, borderRadius: '50%', background: 'var(--accent)', opacity: 0.35 + v * 0.2 }}></span>
                  )}
                </button>
              ))}
            </div>
            {/* Drill-down: every figure leads to its entries (auditability as UX) */}
            {(() => {
              const grid = [null, null, 1, 2, 3, 0, 0, 2, 3, 'now', -1, 0, 0, 0, 1, 2, 2, 3, 1, 0, 0, 2, 1, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0];
              const v = grid[selDay];
              const dayNum = selDay - 1;
              const head = dayNum + '. Juli';
              if (v === -1) return (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-block)', border: '1.5px dashed var(--warn)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>{head}</b> — Buchungslücke: Arbeitstag ohne Buchung.</span>
                  <Button size="sm" variant="secondary">Nachtragen</Button>
                </div>
              );
              if (v === 0 || v === null) return (
                <div style={{ marginTop: 12, fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}><b style={{ color: 'var(--ink-2)' }}>{head}</b> — keine Buchungen (Wochenende/frei).</div>
              );
              const entries = v === 'now'
                ? [['Finanzo Review', 'var(--project-1)', '1:30'], ['Nordwind Call', 'var(--project-3)', '0:45'], ['Sync engine', 'var(--project-2)', '2:10']]
                : [['Finanzo API', 'var(--project-1)', v + ':10'], ['Sync engine', 'var(--project-2)', v === 1 ? '0:50' : (v - 1) + ':40']];
              return (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink)' }}>{head}{v === 'now' ? ' · heute' : ''}</span>
                  {entries.map(([n, c, h]) => (
                    <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }}></span>
                      <span style={{ flex: '1 1 300px', minWidth: 0 }}>{n}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{h}h</span>
                    </span>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}
        {range === 'year' && (
          <Card title="Intensität" subtitle="Letzte 12 Monate" style={{ flex: '1 1 300px', minWidth: 0 }}>
            <Heatmap weeks={12} />
          </Card>
        )}
      </div>

      {/* ---- Todo 41: Rückstau (neu−geschlossen) und Belastung auf EINER Zeitachse ----
           Die Kernthese des Balance-Features sichtbar gemacht: wenn der Backlog
           schneller wächst als du schließt UND die Belastung mitsteigt = Frühwarnung. */}
      <div className="dt-rise" style={{ marginTop: 12, animationDelay: '240ms' }}>
        <Card title="Rückstau trifft Belastung" subtitle={d.label + ' · Netto-Aufgaben vs. Belastungstrend — gleiche Zeitachse'}>
          {(() => {
            const wk = d.burn.tasks; // [neu, zu] pro Woche
            const n = wk.length;
            const W = 620, H = 150, PAD = 30, colW = (W - PAD * 2) / n;
            const nets = wk.map(([a, b]) => a - b);
            const maxNet = Math.max(3, ...nets.map(Math.abs));
            const zeroY = 40, unit = 26 / maxNet; // Balken-Nulllinie oben
            // Belastungstrend (steigend) — normalisiert auf untere Hälfte
            const strain = { week: [52, 58, 61, 64], month: [40, 48, 55, 60, 55, 62], year: [30, 38, 44, 50, 56, 47] }[range] || [50, 55, 60, 64];
            const sN = strain.length;
            const sx = (i) => PAD + (i / (sN - 1)) * (W - PAD * 2);
            const sy = (v) => H - 18 - (v / 100) * (H - 70);
            const strainPts = strain.map((v, i) => sx(i) + ',' + sy(v)).join(' ');
            const cross = nets[n - 1] > 0 && strain[sN - 1] >= 60;
            return (
              <div>
                <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', display: 'block' }}>
                  {/* Balken-Nulllinie */}
                  <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
                  <text x={PAD - 4} y={zeroY + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8" fill="var(--ink-3)">0</text>
                  {/* Netto-Balken: rot = Rückstau wächst, grün = abgebaut */}
                  {nets.map((net, i) => {
                    const h = Math.abs(net) * unit;
                    const up = net > 0;
                    const cx = PAD + colW * i + colW / 2;
                    return (
                      <g key={i}>
                        <rect className="dt-grow" style={{ animationDelay: 150 + i * 90 + 'ms', transformOrigin: 'center ' + zeroY + 'px' }}
                          x={cx - 9} y={up ? zeroY - h : zeroY} width="18" height={Math.max(h, 1)} rx="3"
                          fill={up ? 'var(--warn)' : 'var(--good)'} opacity="0.9" />
                        <text x={cx} y={up ? zeroY - h - 4 : zeroY + h + 11} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fontWeight="700" fill={up ? 'var(--warn)' : 'var(--good)'}>{net > 0 ? '+' + net : net}</text>
                        <text x={cx} y={H - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--ink-3)">{range === 'week' ? 'T' + (i + 1) : 'W' + (i + 1)}</text>
                      </g>
                    );
                  })}
                  {/* Belastungstrend darüber */}
                  <text x={W - PAD} y={sy(strain[0]) - 8} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8" fill="var(--warn)">Belastung</text>
                  <polyline className="dt-draw" pathLength="1" strokeDasharray="1" style={{ animationDuration: '1100ms' }} points={strainPts} fill="none" stroke="var(--warn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
                  {strain.map((v, i) => (
                    <circle key={i} className="dt-pop" style={{ animationDelay: 300 + i * 100 + 'ms' }} cx={sx(i)} cy={sy(v)} r={i === sN - 1 ? 4 : 2.5} fill={i === sN - 1 ? 'var(--warn)' : 'var(--surface)'} stroke="var(--warn)" strokeWidth="1.5" />
                  ))}
                </svg>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--warn)' }}></span> Rückstau wächst (neu &gt; geschlossen)</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--good)' }}></span> abgebaut</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 2, background: 'var(--warn)' }}></span> Belastungstrend</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <AICallout compact title={cross ? 'Beide Kurven zeigen nach oben.' : 'Rückstau und Belastung entkoppeln sich gerade.'}
                    action={<Button size="sm">✦ Backlog priorisieren</Button>}>
                    {cross
                      ? 'Dein Backlog wächst netto (+' + nets[n - 1] + ') und die Belastung steigt parallel — das ist das Muster, das dem Kippen vorausgeht. Vorschlag: diese Woche keine neuen Tasks ziehen, zwei P3 nach KW 29 verschieben.'
                      : 'Du schließt zuletzt mehr, als reinkommt, während die Belastung noch nachhängt — der gesunde Fall. Halte das Tempo, dann fällt der Trend in 1–2 Wochen.'}
                  </AICallout>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
      </div>
    </div>
  );
}
