function ProjectsScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, BudgetRing, WeekSparkline, Badge, Button } = DS;
  const EmptyState = DS.EmptyState || (({ title, children }) => <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-2)' }}><b>{title}</b><div>{children}</div></div>);
  const initials = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('');
  // B8: Kunde → Projekt-Hierarchie. Abrechnung läuft auf Kundenebene (B4).
  const clients = [
    { name: 'Finanzo AG', meta: 'Retainer · 78€/h', color: 'var(--project-1)', openH: 18.5, openEur: '1.443€', projects: [
      { name: 'Website Relaunch', pct: 62, color: 'var(--project-1)', spark: [6, 7.5, 8, 5, 7, 2, 0], hours: '96,5h', budget: '160h' },
      { name: 'Support-Retainer', pct: 41, color: 'var(--project-1)', spark: [1, 2, 1, 2, 1, 0, 0], hours: '8,2h', budget: '20h/Monat' },
    ] },
    { name: 'Nordwind GmbH', meta: 'Fixed scope', color: 'var(--project-3)', openH: 12.8, openEur: '—  (Festpreis)', projects: [
      { name: 'Nordwind App', pct: 91, color: 'var(--project-3)', spark: [3, 4, 5, 6, 4, 0, 0], hours: '72,8h', budget: '80h' },
    ] },
    { name: 'Atlas Kollektiv', meta: 'T&M · 92€/h', color: 'var(--project-4)', openH: 14.5, openEur: '1.334€', projects: [
      { name: 'Atlas Relaunch', pct: 18, color: 'var(--project-4)', spark: [0, 1, 2, 3, 2, 4, 0], hours: '14,5h', budget: '80h' },
    ] },
    { name: 'Intern', meta: 'Kein Budget-Cap · nicht abrechenbar', color: 'var(--project-2)', openH: 0, openEur: null, projects: [
      { name: 'Sync engine', pct: 34, color: 'var(--project-2)', spark: [2, 3, 2, 4, 3, 1, 0], hours: '41,2h', budget: '—' },
    ] },
  ];
  // B4: Positionen der offenen Abrechnung (Mock, Juni-Zeitraum)
  const initialEntries = [
    { id: 1, date: 'Mo 06.07.', proj: 'Website Relaunch', note: 'Checkout-Flow refactoring', h: '6,5h', billable: true },
    { id: 2, date: 'Di 07.07.', proj: 'Website Relaunch', note: 'Review + Deploy', h: '3,0h', billable: true },
    { id: 3, date: 'Mi 08.07.', proj: 'Support-Retainer', note: 'Hotfix Login', h: '1,5h', billable: true },
    { id: 4, date: 'Do 09.07.', proj: 'Website Relaunch', note: 'Interner Sync', h: '0,5h', billable: false },
    { id: 5, date: 'Fr 10.07.', proj: 'Website Relaunch', note: 'CMS-Migration', h: '7,0h', billable: true },
  ];
  const [billing, setBilling] = React.useState(null); // client currently being billed
  const [entries, setEntries] = React.useState(initialEntries);
  const [checked, setChecked] = React.useState(() => new Set(initialEntries.filter((e) => e.billable).map((e) => e.id)));
  const [billed, setBilled] = React.useState(false); // demo: Finanzo Juni schon abgerechnet?
  const [showEmpty, setShowEmpty] = React.useState(false); // C9 preview
  const toggle = (id) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sumH = entries.filter((e) => checked.has(e.id)).reduce((a, e) => a + parseFloat(e.h.replace(',', '.')), 0);
  const exportBill = (kind) => {
    setBilled(true); setBilling(null);
    window.dtToast && window.dtToast('Abrechnung Finanzo AG · Juli (' + String(sumH).replace('.', ',') + 'h) als ' + kind + ' exportiert — Einträge als abgerechnet markiert', () => setBilled(false));
  };

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1 }}>Projects</div>
        <button onClick={() => setShowEmpty((v) => !v)} title="Erster-Start-Zustand ansehen (Design-Preview)" style={{ border: '1px dashed var(--border-strong)', background: 'none', color: 'var(--ink-3)', fontSize: 'var(--fs-2xs)', borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>{showEmpty ? 'Demo-Daten' : 'Minute 1'}</button>
        <Button size="sm">Neuer Kunde</Button>
        <Button size="sm" variant="secondary">Neues Projekt</Button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -28px', padding: '4px 28px 28px' }}>
      <style>{'@keyframes dt-card-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { .dt-card-in { animation: none !important; } }'}</style>
      {showEmpty ? (
        <Card>
          <EmptyState
            icon="folder"
            title="Noch keine Kunden oder Projekte"
            hint="Lege einen Kunden an — Projekte, Stundensätze und Abrechnung hängen daran. Oder importiere Projekte direkt aus Jira/GitHub."
            action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}><Button size="sm">Ersten Kunden anlegen</Button><Button size="sm" variant="secondary">Aus Jira importieren</Button></div>}
          ></EmptyState>
        </Card>
      ) : clients.map((c, ci) => (
        <div key={c.name} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: 'color-mix(in srgb, ' + c.color + ' 16%, var(--surface))', color: c.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{initials(c.name)}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>{c.name}</span>
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>{c.meta}</span>
            <span style={{ flex: 1 }}></span>
            {c.openEur !== null && (c.name === 'Finanzo AG' && billed
              ? <Badge tone="ok">Juli abgerechnet</Badge>
              : c.openH > 0 && <React.Fragment>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}><b style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{String(c.openH).replace('.', ',')}h</b> offen{c.openEur && c.openEur.indexOf('—') !== 0 ? ' · ' + c.openEur : ''}</span>
                  <Button size="sm" variant="secondary" onClick={() => c.name === 'Finanzo AG' && setBilling(c)}>Abrechnung erstellen</Button>
                </React.Fragment>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {c.projects.map((p, idx) => (
              <div key={p.name} className="dt-card-in" style={{ transition: 'transform var(--dur-fast) var(--ease-out)', animation: 'dt-card-in var(--dur-slow) var(--ease-out) backwards ' + (ci * 2 + idx) * 60 + 'ms' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', marginTop: 2 }}>{c.meta}</div>
                    </div>
                    {p.pct >= 80 && <Badge tone="warn">Budget knapp</Badge>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <BudgetRing percent={p.pct} color={p.color} size={72} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)' }}>
                        <span style={{ color: 'var(--ink-2)' }}>Gebucht</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.hours}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)' }}>
                        <span style={{ color: 'var(--ink-2)' }}>Budget</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.budget}</span>
                      </div>
                      <WeekSparkline values={p.spark} color={p.color} width={150} height={30} />
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}
      </div>

      {billing && (
        <div onClick={() => setBilling(null)} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--ink) 32%, transparent)', zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '92vw', height: '100%', background: 'var(--surface)', boxShadow: 'var(--shadow-modal, -8px 0 40px rgba(0,0,0,.18))', display: 'flex', flexDirection: 'column', animation: 'dt-card-in var(--dur-med) var(--ease-out)' }}>
            <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--ink)' }}>Abrechnung · Finanzo AG</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {['Juli 2026', 'Juni 2026', 'Eigener Zeitraum'].map((p, i) => (
                  <button key={p} style={{ border: i === 0 ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)', background: i === 0 ? 'var(--accent-soft, color-mix(in srgb, var(--accent) 10%, var(--surface)))' : 'none', color: i === 0 ? 'var(--accent)' : 'var(--ink-2)', fontWeight: i === 0 ? 700 : 500, fontSize: 'var(--fs-xs)', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 24px' }}>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', margin: '8px 0' }}>Positionen prüfen — abwählen, was nicht auf die Rechnung soll. Nicht-billable Einträge sind vorab abgewählt.</div>
              {entries.map((e) => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', opacity: checked.has(e.id) ? 1 : 0.45 }}>
                  <input type="checkbox" checked={checked.has(e.id)} onChange={() => toggle(e.id)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', width: 62, flexShrink: 0 }}>{e.date}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.note}</span>
                    <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>{e.proj}</span>
                  </span>
                  {!e.billable && <Badge>nicht billable</Badge>}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{e.h}</span>
                </label>
              ))}
            </div>
            <div style={{ padding: '16px 24px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-sunk)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>{checked.size} Positionen · 78€/h</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--ink)' }}>{String(Math.round(sumH * 10) / 10).replace('.', ',')}h · {(Math.round(sumH * 78)).toLocaleString('de-DE')}€</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={() => exportBill('PDF')} style={{ flex: 1 }}>Als PDF exportieren</Button>
                <Button variant="secondary" onClick={() => exportBill('CSV')}>CSV</Button>
                <Button variant="ghost" onClick={() => setBilling(null)}>Abbrechen</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
window.ProjectsScreen = ProjectsScreen;
