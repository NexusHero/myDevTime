import React from 'react'

export function Card({ children, title, subtitle, action, padding = true, style }) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'var(--fs-md)',
                color: 'var(--ink)',
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: padding ? 18 : 0 }}>{children}</div>
    </div>
  )
}
