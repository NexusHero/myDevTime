import React from 'react'
import { Icon } from './Icon'

/**
 * Empty state — calm, useful, never cute: icon in a soft accent disc, one
 * sentence of state, one sentence of next step, optionally one action.
 * (ux-vision §5: trust is the aesthetic — no illustrations, no confetti.)
 */
export function EmptyState({ icon = 'plus', title, hint, action, compact = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        padding: compact ? '22px 18px' : '38px 24px',
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'var(--accent-soft)',
          color: 'var(--accent-strong)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} />
      </span>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'var(--fs-md)',
          color: 'var(--ink)',
        }}
      >
        {title}
      </div>
      {hint && (
        <div
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--ink-2)',
            maxWidth: 380,
            lineHeight: 'var(--lh-normal)',
          }}
        >
          {hint}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
