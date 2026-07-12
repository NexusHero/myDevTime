function AssistantScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const { Card, Badge, Button } = DS;
  // Defensive: never blank-screen on a one-compile-stale bundle
  const Icon = DS.Icon || (() => null);
  const EmptyState = DS.EmptyState || (({ title, hint }) => (
    <div style={{ padding: 24, border: '1.5px dashed var(--border-strong)', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', marginTop: 6 }}>{hint}</div>
    </div>
  ));
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');

  // Grounded, read-only (ux-vision §3, ADR-0005): answers only from the
  // workspace's own data via deterministic query tools; 1 credit per question.
  const SCRIPTED = {
    'Wo bin ich über Budget?': 'Finanzo liegt bei 92% des 40h-Monatsbudgets (36,8h gebucht) — das einzige Projekt über 80%. Huber CMS steht bei 54%, alles andere unter der Hälfte.',
    'Entwirf mein Standup': 'Gestern: 6,4h auf Finanzo-Auth (2,5h), Konflikt-Tests (1,5h) und Reviews. Heute: Sprint-Review um 14:00 und die Tombstone-Story. Keine Blocker gemeldet.',
  };

  const send = (text) => {
    if (!text.trim()) return;
    const answer = SCRIPTED[text] ||
      'In dieser Preview beantworte ich die Beispielfragen. Im Produkt beantwortet der Assistant jede Frage zu deinen Zeiten, Projekten, Budgets und Meetings über deterministische Query-Tools — 1 Credit pro Frage.';
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'assistant', text: answer }]);
    setInput('');
  };

  return (
    <div style={{ padding: 28, maxWidth: 760, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-2xl)', letterSpacing: 'var(--ls-tight)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ai-grad)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="assistant" size={20} /></span>
          Assistant
        </div>
        <Badge tone="neutral">deine Daten · nur Lesezugriff</Badge>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
        {msgs.length === 0 && (
          <EmptyState
            icon="assistant"
            title="Frag deine eigenen Daten"
            hint="Der Assistant antwortet nur aus deinen Zeiten, Projekten, Budgets und Meetings — jede Zahl kommt aus der deterministischen Aggregation, nie aus dem Modell. 1 Credit pro Frage."
          />
        )}
        {msgs.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: 'var(--radius-card)', background: 'var(--accent)', color: 'var(--accent-contrast)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-normal)' }}>{m.text}</div>
          ) : (
            <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%', borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}>
              <div style={{ borderRadius: 'calc(var(--radius-card) - 1.5px)', background: 'var(--surface)', padding: '10px 14px', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-normal)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>{m.text}</span>
                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>Zahlen aus der deterministischen Aggregation · nie aus dem Modell</span>
              </div>
            </div>
          )
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {Object.keys(SCRIPTED).map((s) => (
            <Button key={s} size="sm" variant="ghost" onClick={() => send(s)}>{s}</Button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            placeholder="Frag nach Zeiten, Budgets, Meetings … · 1 Credit"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-block)',
              border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-sm)', outline: 'none',
            }}
          />
          <Button onClick={() => send(input)}>Senden</Button>
        </div>
      </div>
    </div>
  );
}
window.AssistantScreen = AssistantScreen;
