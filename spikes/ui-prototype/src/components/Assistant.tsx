import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { assistantScript, type ChatMsg } from '../data'
import type { View } from '../App'

/** Schließen per Escape — Panels und Dialoge verhalten sich gleich. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}

interface Props {
  onClose: () => void
  onNavigate: (v: View) => void
}

/**
 * KI-Assistent (#20): ausschließlich in Workspace-Daten gegroundet,
 * read-only — Deep-Links statt State-Mutation, definierte Refusals.
 */
export function Assistant({ onClose, onNavigate }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(assistantScript)
  const [input, setInput] = useState('')
  useEscape(onClose)

  const send = (text: string) => {
    if (!text.trim()) return
    setMsgs(m => [
      ...m,
      { role: 'user', text },
      {
        role: 'assistant',
        text: 'Im Prototyp antworte ich nur auf die Beispielfragen — im Produkt beantwortet der Assistent jede Frage zu deinen Zeiten, Projekten, Budgets und Meetings über deterministische Abfrage-Tools (1 Credit pro Frage).',
      },
    ])
    setInput('')
  }

  return (
    <div className="assistant-backdrop" onClick={onClose}>
      <aside className="assistant-panel" role="dialog" aria-label="KI-Assistent" onClick={e => e.stopPropagation()}>
        <header className="as-head">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <Icon name="sparkle" size={16} /> Assistent
          </span>
          <span className="chip">nur deine Daten · read-only</span>
          <button className="icon-btn" onClick={onClose} aria-label="Assistent schließen"><Icon name="x" size={13} /></button>
        </header>

        <div className="as-body">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role} ${m.refusal ? 'refusal' : ''}`}>
              <p>{m.text}</p>
              {m.links && (
                <div className="briefing-row" style={{ marginTop: 8 }}>
                  {m.links.map(l => (
                    <button key={l.label} className="btn btn-ghost btn-sm" onClick={() => { onNavigate(l.view as View); onClose() }}>
                      {l.label} →
                    </button>
                  ))}
                </div>
              )}
              {m.role === 'assistant' && !m.refusal && (
                <span className="msg-src">Zahlen aus der deterministischen Aggregation · nie aus dem Modell</span>
              )}
            </div>
          ))}
        </div>

        <footer className="as-foot">
          <div className="prompt-chips" style={{ marginTop: 0, marginBottom: 8 }}>
            {['Wo liege ich über Budget?', 'Standup für heute?'].map(s => (
              <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
          <div className="as-input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Frage zu deinen Zeiten, Budgets, Meetings … · 1 Credit"
              aria-label="Frage an den Assistenten"
            />
            <button className="btn btn-primary btn-sm" onClick={() => send(input)} aria-label="Senden">
              <Icon name="send" size={14} />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}
