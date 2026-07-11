function TodayScreen({ theme, running, setRunning, paused, setPaused, secs, fmt }) {
  const DS = window.MyDevTimeDesignSystem_254296
  const { DayBlock, Card, Button, Badge } = DS
  // Defensive: never blank-screen on a one-compile-stale bundle
  const Icon = DS.Icon || (() => null)
  const AICallout =
    DS.AICallout ||
    (({ title, children, action }) => (
      <div
        style={{
          padding: '12px 16px',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-card)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>
          {title && <b style={{ color: 'var(--ink)' }}>{title} </b>}
          {children}
        </div>
        {action}
      </div>
    ))
  const MoodCheck = DS.MoodCheck || (() => null)

  // ---- Co-Planner state: ghosts are PROPOSALS (dashed, provenance) ----
  const [ghosts, setGhosts] = React.useState([
    { id: 1, label: 'Deep work: Sync engine', time: '13:00–15:00', color: 'var(--project-2)' },
    { id: 2, label: 'Code review backlog', time: '15:15–16:00', color: 'var(--project-4)' },
  ])
  const [accepted, setAccepted] = React.useState([])
  const [planning, setPlanning] = React.useState(false)
  const [driftEvent, setDriftEvent] = React.useState(true)
  const [task, setTask] = React.useState('Sync engine: conflict resolution')
  const [idleHint, setIdleHint] = React.useState(true)
  const [nl, setNl] = React.useState('')
  const [nlDone, setNlDone] = React.useState(false)

  // One-tap replan: the Co-Planner reflows the rest of the day (deterministic
  // engine proposes; nothing lands without your tap — ADR-0005).
  const replan = () => {
    setPlanning(true)
    setTimeout(() => {
      setGhosts([
        { id: 3, label: 'Deep work: Sync engine', time: '13:00–14:45', color: 'var(--project-2)' },
        {
          id: 4,
          label: 'Nordwind Call (verschoben)',
          time: '15:00–15:45',
          color: 'var(--project-3)',
        },
        { id: 5, label: 'Code review backlog', time: '16:00–16:45', color: 'var(--project-4)' },
      ])
      setDriftEvent(false)
      setPlanning(false)
    }, 900)
  }

  const acceptGhost = g => {
    setAccepted(a => [...a, g.id])
  }
  const dismissGhost = g => {
    setGhosts(gs => gs.filter(x => x.id !== g.id))
  }

  // ---- NL Quick-Add: LIVE deterministic parse (no model, no credit) ----
  const PROJECTS = [
    ['finanzo', 'Finanzo AG', 'var(--project-1)'],
    ['nordwind', 'Nordwind GmbH', 'var(--project-3)'],
    ['sync', 'Sync engine', 'var(--project-2)'],
    ['atlas', 'Atlas Relaunch', 'var(--project-4)'],
  ]
  const parsed = React.useMemo(() => {
    if (!nl.trim()) return null
    const h = nl.match(/(\d+(?:[.,]\d+)?)\s*(?:h|std)/i)
    const m = nl.match(/(\d+)\s*(?:min|m)(?![a-z])/i)
    const proj = PROJECTS.find(p => nl.toLowerCase().includes(p[0]))
    const when = /gestern/i.test(nl) ? 'Gestern' : /morgen/i.test(nl) ? 'Morgen' : 'Heute'
    return { dur: h ? h[1].replace('.', ',') + 'h' : m ? m[1] + 'min' : null, proj, when }
  }, [nl])

  const apps = [
    { name: 'VS Code', mins: 96, pct: 68 },
    { name: 'Chrome — localhost', mins: 21, pct: 15 },
    { name: 'Terminal', mins: 14, pct: 10 },
    { name: 'Figma', mins: 10, pct: 7 },
  ]
  const segColors = ['var(--project-2)', 'var(--project-4)', 'var(--project-1)', 'var(--project-3)']

  return (
    <div style={{ padding: 28, maxWidth: 1080 }}>
      <style>
        {
          '@keyframes dt-rec-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } } @keyframes dt-think { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } } @keyframes dt-ghost-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }'
        }
      </style>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--fs-2xl)',
            letterSpacing: 'var(--ls-tight)',
            color: 'var(--ink)',
          }}
        >
          Today
        </div>
        <div style={{ color: 'var(--ink-2)', fontSize: 'var(--fs-sm)' }}>Tuesday, July 8</div>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--good-soft)',
              color: 'var(--good)',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
            }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }}
            ></span>
            Im Plan · +6m
          </span>
          <span
            title="Belastung: erhöht — 3. Woche über Soll. Details in Reports → Balance"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--warn-soft)',
              color: 'var(--warn)',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)' }}
            ></span>
            Balance: erhöht
          </span>
          <span
            title="12 Tage in Folge ≥ 2h Fokus"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--live-soft)',
              color: 'var(--live-strong)',
              fontSize: 'var(--fs-2xs)',
              fontWeight: 600,
            }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--live)' }}
            ></span>
            Serie 12
          </span>
        </span>
      </div>

      {/* ---- Hero tracker bar ---- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          rowGap: 12,
          flexWrap: 'wrap',
          padding: '18px 22px',
          background: 'var(--surface)',
          border: running ? '1px solid var(--live-border)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: running ? '0 12px 36px -14px rgba(255,83,32,0.35)' : 'var(--shadow-md)',
          transition:
            'border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out)',
          marginBottom: 12,
        }}
      >
        <input
          value={task}
          onChange={e => setTask(e.target.value)}
          placeholder="Woran arbeitest du?"
          style={{
            flex: '1 1 260px',
            minWidth: 40,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--fs-lg)',
            fontWeight: 500,
            color: 'var(--ink)',
            textOverflow: 'ellipsis',
          }}
        />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--surface-sunk)',
            border: '1px solid var(--border)',
            fontSize: 'var(--fs-xs)',
            fontWeight: 600,
            color: 'var(--ink-2)',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          <span
            style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--project-2)' }}
          ></span>
          Sync engine
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xl)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: running ? (paused ? 'var(--warn)' : 'var(--live)') : 'var(--ink-3)',
            textAlign: 'right',
            flexShrink: 0,
            transition: 'color var(--dur-med) var(--ease-out)',
          }}
        >
          {fmt(secs)}
        </span>
        {running && (
          <button
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Weiter' : 'Pause'}
            title={paused ? 'Weiter' : 'Pause'}
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              cursor: 'pointer',
              flexShrink: 0,
              border: '1.5px solid ' + (paused ? 'var(--warn)' : 'var(--border-strong)'),
              background: paused ? 'var(--warn-soft)' : 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition:
                'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
            }}
          >
            {paused ? (
              <span
                style={{
                  width: 0,
                  height: 0,
                  marginLeft: 3,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderLeft: '13px solid var(--warn)',
                }}
              ></span>
            ) : (
              <React.Fragment>
                <span
                  style={{ width: 5, height: 16, borderRadius: 2, background: 'var(--ink-2)' }}
                ></span>
                <span
                  style={{ width: 5, height: 16, borderRadius: 2, background: 'var(--ink-2)' }}
                ></span>
              </React.Fragment>
            )}
          </button>
        )}
        <button
          onClick={() => {
            if (running) {
              setRunning(false)
              setPaused(false)
            } else {
              setRunning(true)
            }
          }}
          aria-label={running ? 'Stop' : 'Start'}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: running ? 'var(--live)' : 'var(--accent)',
            boxShadow: running
              ? '0 10px 28px -8px rgba(255,83,32,0.55)'
              : '0 10px 28px -8px rgba(54,84,224,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition:
              'background var(--dur-med) var(--ease-out), transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-med) var(--ease-out)',
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.92)'
          }}
          onMouseUp={e => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          {running ? (
            <span style={{ width: 20, height: 20, borderRadius: 5, background: '#fff' }}></span>
          ) : (
            <span
              style={{
                width: 0,
                height: 0,
                marginLeft: 5,
                borderTop: '13px solid transparent',
                borderBottom: '13px solid transparent',
                borderLeft: '22px solid #fff',
              }}
            ></span>
          )}
        </button>
      </div>

      {/* ---- Momentary mood — one tap, once a day, feeds Balance ---- */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, minHeight: 30 }}>
        <MoodCheck />
      </div>

      {/* ---- NL Quick-Add with LIVE deterministic parse (⌘K) ---- */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius:
              nl && parsed ? 'var(--radius-card) var(--radius-card) 0 0' : 'var(--radius-pill)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ color: 'var(--ink-3)', display: 'inline-flex' }}>
            <Icon name="plus" size={16} />
          </span>
          <input
            value={nl}
            onChange={e => {
              setNl(e.target.value)
              setNlDone(false)
            }}
            placeholder={'Schnell eintragen: „2h finanzo review gestern"'}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--ink)',
            }}
          />
          <kbd
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '2px 6px',
              background: 'var(--surface-sunk)',
            }}
          >
            ⌘K
          </kbd>
        </div>
        {nl && parsed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 16px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 var(--radius-card) var(--radius-card)',
              animation: 'dt-ghost-in var(--dur-med) var(--ease-out)',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--ls-wide)',
              }}
            >
              Erkannt
            </span>
            {parsed.dur && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-2xs)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  background: 'var(--surface-sunk)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                {parsed.dur}
              </span>
            )}
            {parsed.proj && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 'var(--fs-2xs)',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  background: 'var(--surface-sunk)',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                <span
                  style={{ width: 7, height: 7, borderRadius: '50%', background: parsed.proj[2] }}
                ></span>
                {parsed.proj[1]}
              </span>
            )}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-2xs)',
                fontWeight: 600,
                color: 'var(--ink)',
                background: 'var(--surface-sunk)',
                padding: '3px 10px',
                borderRadius: 'var(--radius-pill)',
              }}
            >
              {parsed.when}
            </span>
            <span style={{ flex: 1, fontSize: 10, color: 'var(--ink-3)' }}>
              deterministisch geparst · kein Credit
            </span>
            <Button
              size="sm"
              onClick={() => {
                setNlDone(true)
                setNl('')
              }}
            >
              Eintragen
            </Button>
          </div>
        )}
        {nlDone && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              fontSize: 'var(--fs-2xs)',
              color: 'var(--good)',
              fontWeight: 600,
            }}
          >
            <Icon name="check" size={14} /> Eintrag angelegt — erscheint im Day Canvas.
          </div>
        )}
      </div>

      {/* ---- Idle-detection hint (REQ-033) ---- */}
      {running && idleHint && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            marginBottom: 24,
            border: '1.5px dashed var(--border-strong)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--warn)',
              flexShrink: 0,
            }}
          ></span>
          <span style={{ flex: 1, fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)', fontWeight: 600 }}>14 min ohne Aktivität</b>{' '}
            (12:04–12:18) — Timer um die Lücke kürzen?
          </span>
          <Button size="sm" variant="secondary" onClick={() => setIdleHint(false)}>
            Kürzen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIdleHint(false)}>
            Behalten
          </Button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ---- Co-Planner briefing: proposals with visible reasoning ---- */}
          <Card
            title="Co-Planner"
            subtitle="Morgen-Briefing · 08:12"
            action={
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <Badge tone="accent">✦ Vorschlag</Badge>
                {ghosts.some(g => !accepted.includes(g.id)) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAccepted(ghosts.map(g => g.id))}
                  >
                    Alle übernehmen
                  </Button>
                )}
              </span>
            }
          >
            {/* Explainable reasoning — WHY this plan (AI signature: gradient hairline) */}
            <div style={{ marginBottom: 14 }}>
              <AICallout compact title="Dein Tag: 3 Meetings, 4,5h Fokus möglich.">
                Nordwind ist bei 91% Budget — Deep Work auf Sync engine priorisiert, Reviews in den
                Nachmittag. Vorschlag unten: annehmen, ziehen oder verwerfen.
              </AICallout>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                opacity: planning ? 0.5 : 1,
                transition: 'opacity var(--dur-med) var(--ease-out)',
              }}
            >
              <DayBlock
                label="Team standup"
                time="09:00–09:15"
                kind="meeting"
                color="var(--project-1)"
                height={48}
              />
              <DayBlock
                label="Finanzo Review"
                time="09:30–11:00"
                kind="actual"
                color="var(--project-1)"
                height={56}
              />
              <DayBlock
                label="Client call — Nordwind"
                time="11:15–12:00"
                kind="meeting"
                color="var(--project-3)"
                height={48}
              />
              {ghosts.map(g => (
                <div
                  key={g.id}
                  style={{ animation: 'dt-ghost-in var(--dur-slow) var(--ease-spring)' }}
                >
                  <DayBlock
                    label={g.label}
                    time={g.time}
                    kind={accepted.includes(g.id) ? 'actual' : 'ghost'}
                    color={g.color}
                    onAccept={() => acceptGhost(g)}
                    onDismiss={() => dismissGhost(g)}
                  />
                </div>
              ))}
            </div>

            {planning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  fontSize: 'var(--fs-2xs)',
                  color: 'var(--accent-strong)',
                  fontWeight: 600,
                  animation: 'dt-think 1s ease infinite',
                }}
              >
                <Icon name="assistant" size={14} /> Co-Planner ordnet den Rest des Tages neu …
              </div>
            )}
            {!planning && accepted.length > 0 && accepted.length === ghosts.length && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  fontSize: 'var(--fs-2xs)',
                  color: 'var(--good)',
                  fontWeight: 600,
                }}
              >
                <Icon name="check" size={14} /> Plan übernommen — {ghosts.length} Blöcke sind jetzt
                fest.
              </div>
            )}
          </Card>

          {/* ---- Drift event: one-tap replan (ux-vision §2.2) — AI signature ---- */}
          {driftEvent && (
            <AICallout
              title="Nordwind Call auf 15:00 verschoben."
              action={
                <React.Fragment>
                  <Button size="sm" onClick={replan}>
                    ✦ Neu planen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDriftEvent(false)}>
                    Ignorieren
                  </Button>
                </React.Fragment>
              }
            >
              Rest des Tages neu planen?
            </AICallout>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            title="Auto-Tracker"
            subtitle={running && !paused ? 'zeichnet auf' : 'pausiert'}
            action={
              running &&
              !paused && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    color: 'var(--live)',
                    letterSpacing: 'var(--ls-wide)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--live)',
                      animation: 'dt-rec-pulse 1.6s ease infinite',
                    }}
                  ></span>
                  REC
                </span>
              )
            }
          >
            <div
              style={{
                display: 'flex',
                height: 10,
                borderRadius: 'var(--radius-pill)',
                overflow: 'hidden',
                gap: 2,
                marginBottom: 14,
              }}
            >
              {apps.map((a, i) => (
                <span key={a.name} style={{ width: a.pct + '%', background: segColors[i] }}></span>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {apps.map((a, i) => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: 'var(--ink)',
                      color: 'var(--surface)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      flexShrink: 0,
                    }}
                  >
                    {a.name[0]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 600,
                        color: 'var(--ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {a.name}
                    </div>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--surface-sunk)',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          width: a.pct + '%',
                          height: '100%',
                          borderRadius: 2,
                          background: segColors[i],
                          transition: 'width var(--dur-slow) var(--ease-out)',
                        }}
                      ></div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-2xs)',
                      color: 'var(--ink-2)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.floor(a.mins / 60) > 0 ? Math.floor(a.mins / 60) + 'h ' : ''}
                    {a.mins % 60}m
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <AICallout compact>
                <b style={{ color: 'var(--ink)', fontWeight: 600 }}>68% im Editor</b> — die Session
                sieht nach reiner Umsetzung aus. Als „Sync engine: Implementierung“ buchen?{' '}
                <span style={{ color: 'var(--ai-ink)', fontWeight: 600, cursor: 'pointer' }}>
                  Übernehmen
                </span>
              </AICallout>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
window.TodayScreen = TodayScreen
