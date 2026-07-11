import React from 'react'

export function StatTile({ label, value, delta, mono = true }) {
  const isUp = typeof delta === 'number' && delta > 0
  const isDown = typeof delta === 'number' && delta < 0
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-2xs)',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-wide)',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
          fontSize: 'var(--fs-xl)',
          fontWeight: 700,
          color: 'var(--ink)',
        }}
      >
        {value}
      </span>
      {delta !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-2xs)',
            fontWeight: 600,
            color: isUp ? 'var(--good)' : isDown ? 'var(--crit)' : 'var(--ink-2)',
          }}
        >
          {isUp ? '+' : ''}
          {delta}
          {typeof delta === 'number' ? '%' : ''}
        </span>
      )}
    </div>
  )
}
