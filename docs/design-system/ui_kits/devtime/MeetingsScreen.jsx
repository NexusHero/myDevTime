function MeetingsScreen() {
  const { Card, Badge, Button } = window.MyDevTimeDesignSystem_254296;
  const MEETINGS = [
    {
      id: 'm1', title: 'Finanzo sprint review', color: 'var(--project-1)', time: '09:30', duration: '46m', state: 'insights',
      summary: [
        'Sync conflict policy signed off — last-writer-wins with tombstones (REQ-006).',
        'Invoice export slips to next sprint; budget rings stay in scope.',
        'Two calendar edge cases reassigned to the automation module.',
      ],
      actions: [
        'Draft ADR amendment for the tombstone retention window',
        'Split the invoice-export story from the timesheet epic',
      ],
    },
    { id: 'm2', title: 'Huber CMS kickoff', color: 'var(--project-6)', time: '13:00', duration: '31m', state: 'transcript' },
    { id: 'm3', title: 'Nordwind planning', color: 'var(--project-3)', time: '15:00', duration: '—', state: 'upcoming' },
  ];
  const [selId, setSelId] = React.useState('m1');
  const [note, setNote] = React.useState(null);
  const sel = MEETINGS.find((m) => m.id === selId) || MEETINGS[0];

  const stateBadge = (s) => s === 'insights' ? { tone: 'good', label: 'Insights ✓' }
    : s === 'transcript' ? { tone: 'neutral', label: 'Transcript' }
    : { tone: 'warn', label: 'Recording opted in' };

  const SectionTitle = ({ children, credit }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>{children}</span>
      {credit && <Badge tone="accent">AI · 1 credit</Badge>}
    </div>
  );

  return (
    <div style={{ height: '100%', boxSizing: 'border-box', maxWidth: 1120, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px 28px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)' }}>Meetings</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-sm)' }}>Transkripte &amp; AI-Insights · nur mit Zustimmung</div>
      </div>

      {/* Zwei unabhängige Scroll-Panes — Liste links, Detail rechts; der Rahmen steht */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
        <div style={{ width: 300, flexShrink: 0, overflowY: 'auto', paddingBottom: 28 }}>
          <Card title="This week">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MEETINGS.map((m) => {
                const active = m.id === selId;
                const b = stateBadge(m.state);
                return (
                  <button key={m.id} onClick={() => { setSelId(m.id); setNote(null); }} style={{
                    display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'stretch', textAlign: 'left',
                    padding: '10px 12px', borderRadius: 'var(--radius-block)', cursor: 'pointer',
                    background: active ? 'var(--bg)' : 'transparent',
                    border: '1px solid ' + (active ? 'var(--border)' : 'transparent'),
                    transition: 'background var(--dur-fast) var(--ease-out)',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }}></span>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink)' }}>{m.title}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{m.time} · {m.duration}</span>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minWidth: 0, paddingBottom: 28 }}>
          <Card title={sel.title} subtitle={sel.time + ' · ' + sel.duration} action={sel.state !== 'upcoming' && <Badge tone="good">Transcript · de</Badge>}>
            {sel.state === 'insights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <SectionTitle credit>Summary</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sel.summary.map((s) => (
                      <div key={s} style={{ display: 'flex', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>
                        <span style={{ color: 'var(--accent)' }}>•</span>
                        <span style={{ flex: 1 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Action items</SectionTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sel.actions.map((a) => (
                      <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-block)', background: 'var(--bg)', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
                        <span style={{ flex: '1 1 220px', fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>{a}</span>
                        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {['Task', 'Jira', 'GitHub', 'Slack'].map((target) => (
                            <Button key={target} size="sm" variant="ghost" onClick={() => setNote('Creates a ' + target + ' item from a preview payload — after you confirm, never automatically.')}>→ {target}</Button>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Custom prompts</SectionTitle>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['Draft follow-up email', 'Extract scope changes', 'List decisions'].map((p) => (
                      <button key={p} onClick={() => setNote('Prompt „' + p + '" would cost 1 AI credit.')} style={{
                        padding: '6px 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border)',
                        background: 'var(--bg)', color: 'var(--ink-2)', fontSize: 'var(--fs-xs)', cursor: 'pointer',
                      }}>✦ {p}</button>
                    ))}
                  </div>
                </div>

                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', lineHeight: 'var(--lh-normal)' }}>
                  Every figure comes from the deterministic core — never the model. The transcript is your data: export and deletion included.
                </div>
              </div>
            )}

            {sel.state === 'transcript' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>Transcript ready — no insights generated yet.</span>
                <Button size="sm" onClick={() => setNote('Summarizing would cost 1 AI credit (demo).')}>✦ Summarize · 1 credit</Button>
              </div>
            )}

            {sel.state === 'upcoming' && (
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', lineHeight: 'var(--lh-normal)' }}>
                Starts at 15:00. Recording consent is granted (revocable per meeting) — the bot joins visibly and every participant sees the recording status.
              </span>
            )}
          </Card>

          {note && (
            <Card>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' }}>{note}</span>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
window.MeetingsScreen = MeetingsScreen;
