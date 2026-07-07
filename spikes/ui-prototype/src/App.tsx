import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { Island, type FocusState } from './components/Island'
import { Palette } from './components/Palette'
import { Assistant } from './components/Assistant'
import { ReviewModal, ReportModal, EditSheet, Onboarding } from './components/Modals'
import { Today } from './views/Today'
import { Planner } from './views/Planner'
import { Projects } from './views/Projects'
import { Reports } from './views/Reports'
import { Meetings } from './views/Meetings'
import { Profile } from './views/Profile'
import {
  DEMO_START, initialBlocks, initialBreaks, punchIn,
  fmtDur, type Block, type BreakSpan, type ProjectId,
} from './data'

export type View = 'today' | 'planner' | 'projects' | 'reports' | 'meetings' | 'profile'

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'today', label: 'Heute', icon: 'today' },
  { id: 'planner', label: 'Planer', icon: 'planner' },
  { id: 'projects', label: 'Projekte', icon: 'projects' },
  { id: 'reports', label: 'Berichte', icon: 'reports' },
  { id: 'meetings', label: 'Meetings', icon: 'meetings' },
  { id: 'profile', label: 'Profil', icon: 'user' },
]

export default function App() {
  const [view, setView] = useState<View>('today')
  const [dark, setDark] = useState(true)
  const [now, setNow] = useState(DEMO_START)
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks)
  const [breaks, setBreaks] = useState<BreakSpan[]>(initialBreaks)
  const [punchedIn, setPunchedIn] = useState(true)
  const [onBreak, setOnBreak] = useState(false)
  const [targetMin, setTargetMin] = useState(8 * 60)
  const [maxMin, setMaxMin] = useState(10 * 60)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [onboardOpen, setOnboardOpen] = useState(true)
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>()

  // Simulierte Live-Uhr: startet 13:37, tickt sekündlich
  useEffect(() => {
    const t = window.setInterval(() => setNow(n => n + 1 / 60), 1000)
    return () => window.clearInterval(t)
  }, [])

  // Theme-Toggle stempelt data-theme auf <html>
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const running = blocks.find(b => b.status === 'running')

  const stopTimer = useCallback(() => {
    setBlocks(bs => bs.map(b => (b.status === 'running' ? { ...b, status: 'actual', end: now } : b)))
    showToast(`Timer gestoppt · ${running ? fmtDur(now - running.start) : ''} erfasst`)
  }, [now, running, showToast])

  const startTimer = useCallback(() => {
    setBlocks(bs => [
      ...bs.map(b => (b.status === 'running' ? { ...b, status: 'actual' as const, end: now } : b)),
      { id: `t${Date.now()}`, title: 'Neuer Timer', project: 'mdt' as ProjectId, start: now, end: now, kind: 'focus', status: 'running', billable: true },
    ])
    showToast('Timer läuft — Titel & Projekt später zuordnen')
  }, [now, showToast])

  const togglePunch = useCallback(() => {
    setPunchedIn(p => {
      showToast(p ? 'Ausgestempelt — schönen Feierabend!' : 'Eingestempelt')
      return !p
    })
  }, [showToast])

  const toggleBreak = useCallback(() => {
    setOnBreak(prev => {
      if (prev) {
        setBreaks(brs => brs.map((br, i) => (i === brs.length - 1 && br.end > 20 * 60 ? { ...br, end: now } : br)))
        showToast('Pause beendet')
      } else {
        setBreaks(brs => [...brs, { start: now, end: 24 * 60 }])
        showToast('Pause läuft — Timer pausiert nicht automatisch (Demo)')
      }
      return !prev
    })
  }, [now, showToast])

  const toggleFocus = useCallback(() => {
    setFocus(f => {
      if (f) {
        showToast('Fokus-Session beendet — zählt zur Serie')
        return null
      }
      showToast('Fokus gestartet · 25 min · DND an (Demo)')
      return { endsAt: now + 25, cycle: 1, totalCycles: 4 }
    })
  }, [now, showToast])

  const acceptGhost = useCallback((id: string) => {
    setBlocks(bs => bs.map(b => (b.id === id ? { ...b, status: 'planned', source: 'Plan: KI übernommen' } : b)))
    showToast('Vorschlag übernommen — als Plan-Block, Provenance bleibt sichtbar')
  }, [showToast])

  const dismissGhost = useCallback((id: string) => {
    setBlocks(bs => bs.filter(b => b.id !== id))
    showToast('Vorschlag verworfen')
  }, [showToast])

  const acceptAll = useCallback(() => {
    setBlocks(bs => bs.map(b => (b.status === 'ghost' ? { ...b, status: 'planned', source: 'Plan: KI übernommen' } : b)))
    showToast('Tagesplan übernommen · 1 AI-Credit')
  }, [showToast])

  const dismissAll = useCallback(() => {
    setBlocks(bs => bs.filter(b => b.status !== 'ghost'))
    showToast('Vorschläge verworfen')
  }, [showToast])

  const quickEntry = useCallback((minutes: number, title: string, yesterday: boolean, project?: string) => {
    if (yesterday) {
      showToast(`„${title}“ (${fmtDur(minutes)}) für gestern angelegt — im Planer sichtbar`)
      return
    }
    setBlocks(bs => [
      ...bs,
      { id: `q${Date.now()}`, title, project: project as ProjectId | undefined, start: now - minutes, end: now, kind: 'focus', status: 'actual', billable: true, source: 'NL-Eintrag' },
    ])
    setView('today')
    showToast(`Eintrag angelegt: ${title} · ${fmtDur(minutes)}`)
  }, [now, showToast])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">mD</span>
          <span className="brand-name">my<span>Dev</span>Time</span>
        </div>
        <nav aria-label="Hauptnavigation">
          {NAV.map(n => (
            <button
              key={n.id}
              className="nav-item"
              aria-current={view === n.id ? 'page' : undefined}
              onClick={() => setView(n.id)}
            >
              <Icon name={n.icon} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-item" onClick={() => setAssistantOpen(true)}>
            <Icon name="sparkle" /> Assistent
          </button>
          <button className="palette-hint" onClick={() => setPaletteOpen(true)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="search" size={14} /> Suchen & erfassen</span>
            <kbd>⌘K</kbd>
          </button>
          <button className="theme-toggle" onClick={() => setDark(d => !d)}>
            <Icon name={dark ? 'sun' : 'moon'} size={16} /> {dark ? 'Helles Theme' : 'Dunkles Theme'}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          {view === 'today' && (
            <Today
              blocks={blocks} breaks={breaks} punchIn={punchIn} punchedIn={punchedIn} now={now}
              targetMin={targetMin} maxMin={maxMin}
              onTargetChange={setTargetMin} onMaxChange={setMaxMin}
              onTogglePunch={togglePunch}
              onAcceptGhost={acceptGhost} onDismissGhost={dismissGhost}
              onAcceptAll={acceptAll} onDismissAll={dismissAll}
              onGapClick={() => setPaletteOpen(true)}
              onOpenReview={() => setReviewOpen(true)}
              onEditBlock={setEditId}
            />
          )}
          {view === 'planner' && <Planner />}
          {view === 'projects' && <Projects />}
          {view === 'reports' && <Reports onOpenReport={() => setReportOpen(true)} onToast={showToast} />}
          {view === 'meetings' && <Meetings onToast={showToast} />}
          {view === 'profile' && <Profile onToast={showToast} />}
        </div>
      </main>

      <Island
        now={now} running={running} punchedIn={punchedIn} onBreak={onBreak} focus={focus}
        onStop={stopTimer} onStart={startTimer} onToggleBreak={toggleBreak} onTogglePunch={togglePunch}
        onToggleFocus={toggleFocus}
      />

      <nav className="tabbar" aria-label="Hauptnavigation">
        {NAV.map(n => (
          <button key={n.id} className="tab" aria-current={view === n.id ? 'page' : undefined} onClick={() => setView(n.id)}>
            <Icon name={n.icon} /> {n.label}
          </button>
        ))}
      </nav>

      {paletteOpen && (
        <Palette
          onClose={() => setPaletteOpen(false)}
          onNavigate={setView}
          onQuickEntry={quickEntry}
          onTogglePunch={togglePunch}
          onToggleBreak={toggleBreak}
          onOpenAssistant={() => setAssistantOpen(true)}
          onOpenReport={() => setReportOpen(true)}
          onOpenReview={() => setReviewOpen(true)}
        />
      )}
      {assistantOpen && <Assistant onClose={() => setAssistantOpen(false)} onNavigate={setView} />}
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} onToast={showToast} />}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onToast={showToast} />}
      {editId && (() => {
        const blk = blocks.find(b => b.id === editId)
        return blk ? (
          <EditSheet
            block={blk} now={now}
            onSave={patch => { setBlocks(bs => bs.map(b => (b.id === editId ? { ...b, ...patch } : b))); showToast('Eintrag gespeichert') }}
            onDelete={() => { setBlocks(bs => bs.filter(b => b.id !== editId)); showToast('Eintrag gelöscht') }}
            onClose={() => setEditId(null)}
          />
        ) : null
      })()}
      {onboardOpen && <Onboarding onClose={() => setOnboardOpen(false)} />}

      <button className="fab" onClick={() => setPaletteOpen(true)} aria-label="Schnell erfassen">
        <Icon name="plus" size={24} />
      </button>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
