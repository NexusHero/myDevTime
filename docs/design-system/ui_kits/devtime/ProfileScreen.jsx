function ProfileScreen({ theme, setTheme, mode, setMode }) {
  const { Card, Switch, StatTile, Badge, Button } = window.MyDevTimeDesignSystem_254296;
  const [reminders, setReminders] = React.useState(true);
  const [autoCapture, setAutoCapture] = React.useState(true);
  const [autoTracker, setAutoTracker] = React.useState(true);
  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', flex: 1 }}>Profil &amp; Einstellungen</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -28px', padding: '4px 28px 28px' }}>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: 'linear-gradient(135deg, #3D5CF5, #2941B8)', color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
              }}>SS</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>Suhay Sevinc</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', marginTop: 2 }}>suhay@mydevtime.app</div>
              </div>
              <Badge tone="accent">Pro</Badge>
            </div>
          </Card>
          <Card title="Darstellung">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Accent</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['blueprint', 'Königsblau'], ['sovereign', 'Sovereign'], ['ember', 'Ember']].map(([t, label]) => (
                    <button key={t} onClick={() => setTheme && setTheme(t)} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '9px 10px', borderRadius: 'var(--radius-block)', cursor: 'pointer',
                      border: '1.5px solid ' + (theme === t ? 'var(--accent)' : 'var(--border)'),
                      background: theme === t ? 'var(--accent-soft)' : 'var(--surface)',
                      color: 'var(--ink)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                      transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
                    }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: t === 'blueprint' ? 'var(--blueprint-500)' : t === 'sovereign' ? 'var(--sovereign-500)' : 'var(--ember-500)' }}></span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', marginBottom: 8 }}>Modus</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['light', 'Hell'], ['dark', 'Dunkel']].map(([m, label]) => (
                    <button key={m} onClick={() => setMode && setMode(m)} style={{
                      flex: 1, padding: '9px 10px', borderRadius: 'var(--radius-block)', cursor: 'pointer',
                      border: '1.5px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
                      background: mode === m ? 'var(--accent-soft)' : 'var(--surface)',
                      color: 'var(--ink)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                      transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
                    }}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <Card title="Arbeitszeit" subtitle="REQ-028 · ArbZG §4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>Soll pro Tag</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '2px 4px' }}>
                  <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 9px' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>8:20h</span>
                  <button style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-2)', fontSize: 14, padding: '2px 9px' }}>+</button>
                </span>
              </div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', marginTop: -8 }}>
                8:00h + 15 min/Tag Vorarbeit für Betriebsschließtage
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>Wochen-Soll</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>41:40h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>Wochenmodell</span>
                <span style={{ display: 'flex', gap: 4 }}>
                  {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
                    <span key={d} style={{
                      width: 26, height: 26, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                      background: i < 5 ? 'var(--accent-soft)' : 'var(--surface-sunk)',
                      color: i < 5 ? 'var(--accent-strong)' : 'var(--ink-3)',
                    }}>{d}</span>
                  ))}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>Überstunden-Saldo</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--good)', fontVariantNumeric: 'tabular-nums' }}>+9:30h</span>
              </div>
              <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>
                Pausenwarnungen folgen dem ArbZG-§4-Preset — ein Hinweis, keine Rechtsberatung.
              </div>
            </div>
          </Card>
          <Card title="Einstellungen">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Switch checked={reminders} onChange={setReminders} label="Pausen-Erinnerungen (ArbZG)" />
              <Switch checked={autoCapture} onChange={setAutoCapture} label="Kalender-Auto-Erfassung" />
              <Switch checked={autoTracker} onChange={setAutoTracker} label="Auto-Tracker (App-Nutzung aufzeichnen)" />
            </div>
          </Card>
        </div>
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Integrationen" subtitle="Export nur nach Bestätigung — nie automatisch">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['GitHub', 'Action Items → Issues · Commits als Zeitvorschlag', true],
                ['Jira', 'Action Items → Tickets', true],
                ['Linear', 'Action Items → Issues', false],
                ['Slack', 'Insights → Channel', true],
              ].map(([name, desc, on]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--ink)', color: 'var(--surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{name[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)' }}>{name}</div>
                    <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
                  </div>
                  <Badge tone={on ? 'good' : 'neutral'}>{on ? 'Verbunden' : 'Verbinden'}</Badge>
                </div>
              ))}
            </div>
          </Card>
          <Card title="AI-Credits" action={<Button size="sm" variant="secondary">Aufladen</Button>}>
            <StatTile label="Guthaben" value="34" mono />
          </Card>
          <Card title="Abwesenheiten">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge tone="accent">18 / 30 Tage</Badge>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)' }}>Urlaub verbleibend</span>
            </div>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
window.ProfileScreen = ProfileScreen;
