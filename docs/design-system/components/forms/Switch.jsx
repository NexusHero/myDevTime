import React from 'react'

export function Switch({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <span
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 40,
          height: 24,
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--accent)' : 'var(--border-strong)',
          position: 'relative',
          transition: 'background var(--dur-med) var(--ease-out)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 19 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: 'var(--shadow-sm)',
            transition: 'left var(--dur-med) var(--ease-out)',
          }}
        />
      </span>
      {label && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>{label}</span>}
    </label>
  )
}
