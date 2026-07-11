import React from 'react'

export function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
      <span
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: checked ? 'var(--accent)' : 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition:
            'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
        }}
      >
        {checked && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        )}
      </span>
      {label && <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>{label}</span>}
    </label>
  )
}
