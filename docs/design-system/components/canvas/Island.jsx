import React from 'react'

/**
 * The Island (ux-vision §2.3) — one persistent, glanceable pill carrying
 * live state (running timer + punch status). Collapsed by default; expands
 * to quick actions on click. Morphs (not swaps) between states.
 */
export function Island({
  running = true,
  elapsed = '00:42:11',
  punched = true,
  expanded = false,
  onToggle,
  actions = [],
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: expanded ? 10 : 0,
        background: 'var(--canvas-900, #0f1318)',
        color: '#fff',
        borderRadius: expanded ? 'var(--radius-xl)' : 'var(--radius-pill)',
        padding: expanded ? 16 : '10px 18px',
        boxShadow: 'var(--shadow-lg)',
        cursor: 'pointer',
        transition: `border-radius var(--dur-med) var(--ease-spring), padding var(--dur-med) var(--ease-spring)`,
        minWidth: expanded ? 220 : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: running ? 'var(--accent)' : 'var(--ink-3, #666)',
            boxShadow: running
              ? '0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent)'
              : 'none',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {elapsed}
        </span>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'rgba(255,255,255,0.55)' }}>
          {punched ? 'Eingestempelt' : 'Ausgestempelt'}
        </span>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.map(a => (
            <button
              key={a.label}
              onClick={e => {
                e.stopPropagation()
                a.onClick && a.onClick()
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 'var(--fs-2xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
