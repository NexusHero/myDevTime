import React from 'react'
import { Icon } from './Icon'

/**
 * The omnipresent "ask your data" bar — AI reachable on EVERY screen, not
 * just the Assistant tab (the awork-class pattern). Gradient hairline =
 * AI signature; scope chips show which data the answer draws from;
 * answers come from deterministic query tools (grounded, read-only).
 */
export function AIAskBar({
  placeholder = 'Frag deine Daten …',
  scopes = ['Projekte', 'Zeiten', 'Budgets'],
  answers = {},
  defaultAnswer = 'In dieser Preview beantworte ich die Beispielfragen — im Produkt jede Frage zu deinen Daten. 1 Credit pro Frage.',
}) {
  const [q, setQ] = React.useState('')
  const [asked, setAsked] = React.useState(null)
  const ask = text => {
    if (!text.trim()) return
    setAsked({ q: text, a: answers[text] || defaultAnswer })
    setQ('')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{ borderRadius: 'var(--radius-pill)', padding: 1.5, background: 'var(--ai-grad)' }}
      >
        <div
          style={{
            borderRadius: 'calc(var(--radius-pill) - 1.5px)',
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 10px 9px 14px',
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              background: 'var(--ai-grad)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="assistant" size={14} />
          </span>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') ask(q)
            }}
            placeholder={placeholder}
            style={{
              flex: 1,
              minWidth: 40,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--fs-sm)',
              color: 'var(--ink)',
            }}
          />
          <span style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {scopes.map(s => (
              <span
                key={s}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '3px 9px',
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </span>
            ))}
          </span>
          <button
            onClick={() => ask(q)}
            aria-label="Fragen"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name="chevronRight" size={15} />
          </button>
        </div>
      </div>
      {!asked && Object.keys(answers).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.keys(answers).map(s => (
            <button
              key={s}
              onClick={() => ask(s)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-pill)',
                padding: '5px 12px',
                fontSize: 'var(--fs-2xs)',
                fontWeight: 600,
                color: 'var(--ink-2)',
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {asked && (
        <div
          style={{ borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}
        >
          <div
            style={{
              borderRadius: 'calc(var(--radius-card) - 1.5px)',
              background: 'var(--surface)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--ai-ink)' }}>
              ✦ {asked.q}
            </div>
            <div
              style={{
                fontSize: 'var(--fs-xs)',
                color: 'var(--ink)',
                lineHeight: 'var(--lh-normal)',
              }}
            >
              {asked.a}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 10, color: 'var(--ink-3)' }}>
                Zahlen aus der deterministischen Aggregation · nie aus dem Modell
              </span>
              <button
                onClick={() => setAsked(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--ink-3)',
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
