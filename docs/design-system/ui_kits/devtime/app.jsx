function DevTimeApp() {
  const { AppShell, Island } = window.MyDevTimeDesignSystem_254296
  const [screen, setScreen] = React.useState('today')
  const [theme, setTheme] = React.useState('blueprint')
  const [mode, setMode] = React.useState('light')

  // Shared live-timer state — ONE clock for the whole app: the Today hero
  // owns it on Today; the Island carries it on every other screen.
  const [running, setRunning] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const [secs, setSecs] = React.useState(2531)
  const [islandExpanded, setIslandExpanded] = React.useState(false)
  React.useEffect(() => {
    if (!running || paused) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [running, paused])
  const fmt = s =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map(n => String(n).padStart(2, '0'))
      .join(':')

  const screens = {
    today: window.TodayScreen,
    planner: window.PlannerScreen,
    projects: window.ProjectsScreen,
    reports: window.ReportsScreen,
    meetings: window.MeetingsScreen,
    assistant: window.AssistantScreen,
    profile: window.ProfileScreen,
  }
  const Screen = screens[screen] || window.TodayScreen

  return (
    <div data-theme={theme} data-mode={mode} style={{ height: '100vh', background: 'var(--bg)' }}>
      <AppShell posture="sidebar" active={screen} onNavigate={setScreen}>
        {/* All screens stay MOUNTED (hidden via display) so local state —
            mood tap, dismissed hints, accepted ghosts, check-ins — survives
            tab switches. Only the active one is visible. */}
        {Object.entries(screens).map(([id, S]) => (
          <div key={id} style={{ display: screen === id ? 'block' : 'none', height: '100%' }}>
            <S
              theme={theme}
              setTheme={setTheme}
              mode={mode}
              setMode={setMode}
              running={running}
              setRunning={setRunning}
              paused={paused}
              setPaused={setPaused}
              secs={secs}
              fmt={fmt}
            />
          </div>
        ))}
      </AppShell>
      {/* The Island: persistent live state on every screen EXCEPT Today,
          where the hero tracker bar carries it — never two clocks at once. */}
      {screen !== 'today' && (
        <div
          style={{
            position: 'fixed',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 40,
          }}
        >
          <Island
            running={running}
            elapsed={fmt(secs)}
            punched
            expanded={islandExpanded}
            onToggle={() => setIslandExpanded(!islandExpanded)}
            actions={[
              running
                ? { label: paused ? 'Weiter' : 'Pause', onClick: () => setPaused(!paused) }
                : { label: 'Start', onClick: () => setRunning(true) },
              running
                ? {
                    label: 'Stop',
                    onClick: () => {
                      setRunning(false)
                      setPaused(false)
                    },
                  }
                : { label: 'Zu Today', onClick: () => setScreen('today') },
            ]}
          />
        </div>
      )}
    </div>
  )
}

const __dtRootEl = document.getElementById('root')
__dtRootEl.__reactRoot = __dtRootEl.__reactRoot || ReactDOM.createRoot(__dtRootEl)
__dtRootEl.__reactRoot.render(<DevTimeApp />)
