function DevTimeApp() {
  const { AppShell, Island } = window.MyDevTimeDesignSystem_254296;
  const [screen, setScreen] = React.useState('today');
  const [theme, setTheme] = React.useState('blueprint');
  const [mode, setMode] = React.useState('light');

  // Shared live-timer state — ONE clock for the whole app: the Today hero
  // owns it on Today; the Island carries it on every other screen.
  const [running, setRunning] = React.useState(true);
  const [paused, setPaused] = React.useState(false);

  // C10: globaler Undo-Toast — Screens rufen window.dtToast(msg, onUndo)
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  React.useEffect(() => {
    window.dtToast = (msg, onUndo) => {
      clearTimeout(toastTimer.current);
      setToast({ msg, onUndo });
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    };
    return () => { delete window.dtToast; clearTimeout(toastTimer.current); };
  }, []);
  const [secs, setSecs] = React.useState(2531);
  const [islandExpanded, setIslandExpanded] = React.useState(false);
  const [punched, setPunched] = React.useState(true);
  const punchOut = () => { setPunched(false); setRunning(false); setPaused(false); };
  const punchIn = () => { setPunched(true); };
  React.useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);
  const fmt = (s) => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0')).join(':');

  const screens = {
    today: window.TodayScreen,
    planner: window.PlannerScreen,
    absence: window.AbsenceScreen,
    projects: window.ProjectsScreen,
    reports: window.ReportsScreen,
    meetings: window.MeetingsScreen,
    assistant: window.AssistantScreen,
    profile: window.ProfileScreen,
  };
  const Screen = screens[screen] || window.TodayScreen;

  return (
    <div data-theme={theme} data-mode={mode} style={{ height: '100vh', background: 'var(--bg)' }}>
      <AppShell
        posture="sidebar"
        active={screen}
        onNavigate={setScreen}
        island={screen !== 'today' && (
          /* Docked in the sidebar footer — always visible, never covering
             the working surface. Hidden on Today, where the hero tracker
             carries the clock: never two clocks at once. */
          <Island
            posture="docked"
            running={running}
            elapsed={fmt(secs)}
            punched={punched}
            expanded={islandExpanded}
            onToggle={() => setIslandExpanded(!islandExpanded)}
            actions={
              punched
                ? [
                    running ? { label: paused ? 'Weiter' : 'Pause', onClick: () => setPaused(!paused) } : { label: 'Start', onClick: () => setRunning(true) },
                    ...(running ? [{ label: 'Stop', onClick: () => { setRunning(false); setPaused(false); } }] : []),
                    /* Punch out right here — no forced trip to Today */
                    { label: 'Ausstempeln', onClick: punchOut },
                  ]
                : [
                    { label: 'Einstempeln', onClick: punchIn },
                    { label: 'Zu Today', onClick: () => setScreen('today') },
                  ]
            }
          />
        )}
      >
        {/* All screens stay MOUNTED (hidden via display) so local state —
            mood tap, dismissed hints, accepted ghosts, check-ins — survives
            tab switches. Only the active one is visible. */}
        {Object.entries(screens).map(([id, S]) => (
          <div key={id} style={{ display: screen === id ? 'block' : 'none', height: '100%' }}>
            <S theme={theme} setTheme={setTheme} mode={mode} setMode={setMode} running={running} setRunning={setRunning} paused={paused} setPaused={setPaused} secs={secs} fmt={fmt} />
          </div>
        ))}
      </AppShell>
      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 200, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 12, padding: '11px 16px', boxShadow: '0 12px 32px rgba(0,0,0,.28)', maxWidth: 560, animation: 'dt-toast-in var(--dur-med, .25s) var(--ease-out, ease-out)' }}>
          <style>{'@keyframes dt-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }'}</style>
          <span style={{ fontSize: 13, lineHeight: 1.4 }}>{toast.msg}</span>
          {toast.onUndo && <button onClick={() => { toast.onUndo(); setToast(null); }} style={{ border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}>Rückgängig</button>}
          <button onClick={() => setToast(null)} aria-label="Schließen" style={{ border: 'none', background: 'none', color: 'var(--bg)', opacity: 0.6, cursor: 'pointer', fontSize: 15, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}
    </div>
  );
}

const __dtRootEl = document.getElementById('root');
__dtRootEl.__reactRoot = __dtRootEl.__reactRoot || ReactDOM.createRoot(__dtRootEl);
__dtRootEl.__reactRoot.render(<DevTimeApp />);
