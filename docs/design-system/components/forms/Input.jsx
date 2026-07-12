import React from 'react';

export function Input({ label, placeholder, value, onChange, type = 'text', mono = false, error }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink-2)' }}>{label}</span>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          height: 'var(--touch-target)',
          padding: '0 14px',
          borderRadius: 'var(--radius-block)',
          border: `1px solid ${error ? 'var(--crit)' : 'var(--border-strong)'}`,
          background: 'var(--surface)',
          color: 'var(--ink)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
          fontSize: 'var(--fs-sm)',
          outline: 'none',
          transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--crit)' : 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {error && <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--crit)' }}>{error}</span>}
    </label>
  );
}
