import React from 'react'

export function Select({ label, value, onChange, options = [] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink-2)' }}>
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          height: 'var(--touch-target)',
          padding: '0 14px',
          borderRadius: 'var(--radius-block)',
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--fs-sm)',
          outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
