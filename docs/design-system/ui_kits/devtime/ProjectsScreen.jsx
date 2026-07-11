function ProjectsScreen() {
  const { Card, BudgetRing, WeekSparkline, Badge, Button } = window.MyDevTimeDesignSystem_254296
  const projects = [
    {
      name: 'Finanzo AG',
      client: 'Retainer · 78€/h',
      pct: 62,
      color: 'var(--project-1)',
      spark: [6, 7.5, 8, 5, 7, 2, 0],
      hours: '96,5h',
      budget: '160h',
    },
    {
      name: 'Nordwind GmbH',
      client: 'Fixed scope',
      pct: 91,
      color: 'var(--project-3)',
      spark: [3, 4, 5, 6, 4, 0, 0],
      hours: '72,8h',
      budget: '80h',
    },
    {
      name: 'Sync engine',
      client: 'Intern · kein Budget-Cap',
      pct: 34,
      color: 'var(--project-2)',
      spark: [2, 3, 2, 4, 3, 1, 0],
      hours: '41,2h',
      budget: '—',
    },
    {
      name: 'Atlas Relaunch',
      client: 'T&M · 92€/h',
      pct: 18,
      color: 'var(--project-4)',
      spark: [0, 1, 2, 3, 2, 4, 0],
      hours: '14,5h',
      budget: '80h',
    },
  ]
  const initials = n =>
    n
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')

  return (
    <div style={{ padding: 28, maxWidth: 1120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'var(--fs-2xl)',
            letterSpacing: 'var(--ls-tight)',
            color: 'var(--ink)',
            flex: 1,
          }}
        >
          Projects
        </div>
        <Button size="sm">Neues Projekt</Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {projects.map(p => (
          <div
            key={p.name}
            style={{ transition: 'transform var(--dur-fast) var(--ease-out)' }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: 'color-mix(in srgb, ' + p.color + ' 16%, var(--surface))',
                    color: p.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {initials(p.name)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 'var(--fs-md)',
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', marginTop: 2 }}>
                    {p.client}
                  </div>
                </div>
                {p.pct >= 80 && <Badge tone="warn">Budget knapp</Badge>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <BudgetRing percent={p.pct} color={p.color} size={72} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--fs-xs)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)' }}>Gebucht</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {p.hours}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--fs-xs)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)' }}>Budget</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--ink)',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {p.budget}
                    </span>
                  </div>
                  <WeekSparkline values={p.spark} color={p.color} width={150} height={30} />
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
window.ProjectsScreen = ProjectsScreen
