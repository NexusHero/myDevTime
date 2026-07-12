/* Absence module — punch-clock users' second half of the app: Urlaub,
   Krank, Gleittage, Feiertage (Baden-Württemberg). Bounded layout:
   header fixed, content scrolls internally. AI only PROPOSES (Brückentag
   via AICallout) — never books anything. */
function AbsenceScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, Badge, Button, AICallout, Icon } = DS;
  /* Guard against bundle lag: if the freshly-added LeaveBalance hasn't been
     recompiled into _ds_bundle.js yet, render an inline fallback instead of
     crashing the whole app mount (same pattern as TodayScreen's MoodCheck). */
  const LeaveBalance = DS.LeaveBalance || (({ entitlement = 30, taken = 0, planned = 0, carryover = 0 }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{Math.max(0, entitlement + carryover - taken - planned)}</span>
      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>Tage Urlaub übrig</span>
    </div>
  ));
  const YEAR = 2026;
  const [showForm, setShowForm] = React.useState(false);
  const [reqType, setReqType] = React.useState('Urlaub');
  const [from, setFrom] = React.useState('2026-08-24');
  const [to, setTo] = React.useState('2026-08-25');
  const [requests, setRequests] = React.useState([
    { type: 'Urlaub', range: '10.–14. Aug', days: 5, status: 'Genehmigt' },
  ]);

  // BW public holidays 2026 (month 1-based)
  const HOLIDAYS = [
    [1, 1, 'Neujahr'], [1, 6, 'Hl. Drei Könige'], [4, 3, 'Karfreitag'], [4, 6, 'Ostermontag'],
    [5, 1, 'Tag der Arbeit'], [5, 14, 'Christi Himmelfahrt'], [5, 25, 'Pfingstmontag'], [6, 4, 'Fronleichnam'],
    [10, 3, 'Tag der Dt. Einheit'], [11, 1, 'Allerheiligen'], [12, 25, '1. Weihnachtstag'], [12, 26, '2. Weihnachtstag'],
  ];
  const VACATION = [[2, 9], [2, 10], [2, 11], [2, 12], [2, 13], [5, 15], [5, 26], [5, 27], [5, 28], [5, 29], [7, 6], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14]];
  const SICK = [[3, 17], [3, 18], [3, 19]];

  const typeOf = (m, d) => {
    if (HOLIDAYS.some(([hm, hd]) => hm === m && hd === d)) return 'holiday';
    if (SICK.some(([sm, sd]) => sm === m && sd === d)) return 'sick';
    if (VACATION.some(([vm, vd]) => vm === m && vd === d)) return 'vacation';
    const wd = new Date(YEAR, m - 1, d).getDay();
    if (wd === 0 || wd === 6) return 'weekend';
    return null;
  };
  const cellBg = {
    holiday: 'var(--ink-3)', sick: 'var(--bad)', vacation: 'var(--accent)',
    weekend: 'var(--surface-sunk)', null: 'transparent',
  };
  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const daysIn = (m) => new Date(YEAR, m, 0).getDate();
  const TODAY = [7, 12]; // 12. Juli

  const fmtD = (iso) => { const [, m, d] = iso.split('-'); return parseInt(d) + '.' + parseInt(m) + '.'; };
  const submit = () => {
    const d1 = new Date(from), d2 = new Date(to);
    let n = 0;
    for (let t = new Date(d1); t <= d2; t.setDate(t.getDate() + 1)) {
      const wd = t.getDay();
      if (wd !== 0 && wd !== 6) n++;
    }
    setRequests((rs) => [...rs, { type: reqType, range: fmtD(from) + '–' + fmtD(to), days: Math.max(1, n), status: 'Angefragt' }]);
    setShowForm(false);
  };

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap', rowGap: 10 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1, minWidth: 160 }}>Absence</div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 6px', background: 'var(--surface)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 8px' }}>‹</button>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)' }}>{YEAR}</span>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 8px' }}>›</button>
        </span>
        <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}><Button size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Abbrechen' : 'Antrag stellen'}</Button></span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -28px', padding: '4px 28px 28px' }}>
        {showForm && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Art</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Urlaub', 'Gleittag', 'Sonderurlaub'].map((t) => (
                    <button key={t} onClick={() => setReqType(t)} style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600,
                      border: reqType === t ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
                      background: reqType === t ? 'var(--accent-soft)' : 'var(--surface)',
                      color: reqType === t ? 'var(--accent-strong)' : 'var(--ink-2)',
                    }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Von</div>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Bis</div>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: '9px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              </div>
              <Button onClick={submit}>Anfragen</Button>
            </div>
          </Card>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Card title="Urlaubskonto" style={{ flex: '2 1 340px' }}>
            <LeaveBalance entitlement={30} taken={11} planned={5} carryover={2} />
          </Card>
          <Card title="Krank" subtitle="dieses Jahr" style={{ flex: '1 1 150px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>3</span>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>Tage</span>
            </div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 10 }}>zuletzt 17.–19. März</div>
          </Card>
          <Card title="Gleitzeit-Konto" subtitle="AZK" style={{ flex: '1 1 150px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--good)' }}>+12:40</span>
            </div>
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 10 }}>≈ 1,5 Gleittage möglich</div>
          </Card>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Card title="Jahresübersicht" subtitle="Urlaub · Krank · Feiertage (Baden-Württemberg)" style={{ flex: '2 1 520px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {MONTHS.map((name, mi) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 30, fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{name}</span>
                  <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                      if (d > daysIn(mi + 1)) return <span key={d} style={{ flex: 1 }}></span>;
                      const t = typeOf(mi + 1, d);
                      const isToday = mi + 1 === TODAY[0] && d === TODAY[1];
                      return (
                        <span key={d} title={name + ' ' + d + '.'} style={{
                          flex: 1, aspectRatio: '1 / 1.5', maxWidth: 16, borderRadius: 3,
                          background: cellBg[t] || 'transparent',
                          border: isToday ? '1.5px solid var(--live)' : (t ? 'none' : '1px solid var(--border)'),
                          boxSizing: 'border-box',
                        }}></span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }}></span>Urlaub</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--bad)' }}></span>Krank</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--ink-3)' }}></span>Feiertag</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-sunk)', border: '1px solid var(--border)', boxSizing: 'border-box' }}></span>Wochenende</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, border: '1.5px solid var(--live)', boxSizing: 'border-box' }}></span>Heute</span>
            </div>
          </Card>

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AICallout compact title="Brückentag-Chance" action={<Button size="sm" onClick={() => setRequests((rs) => rs.some((r) => r.range === '15. Mai') ? rs : [...rs, { type: 'Urlaub', range: '15. Mai', days: 1, status: 'Angefragt' }])}>✦ Anfragen</Button>}>
              Christi Himmelfahrt ist Do 14.5. — mit Fr 15.5. werden aus 1 Urlaubstag 4 freie Tage.
            </AICallout>
            <Card title="Anträge">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {requests.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--ink)' }}>{r.type} · {r.range}</div>
                      <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{r.days} {r.days === 1 ? 'Tag' : 'Tage'}</div>
                    </div>
                    <Badge tone={r.status === 'Genehmigt' ? 'good' : 'neutral'}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Nächste Feiertage" subtitle="Baden-Württemberg">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[['Sa 3.10.', 'Tag der Dt. Einheit'], ['So 1.11.', 'Allerheiligen'], ['Fr 25.12.', '1. Weihnachtstag'], ['Sa 26.12.', '2. Weihnachtstag']].map(([d, n]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', width: 62, flexShrink: 0 }}>{d}</span>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink)' }}>{n}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
window.AbsenceScreen = AbsenceScreen;
