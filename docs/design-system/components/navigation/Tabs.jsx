import React from 'react';

export function Tabs({ items, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
      {items.map((it) => (
        <button
          key={it.value}
          onClick={() => onChange && onChange(it.value)}
          style={{
            padding: '10px 4px',
            marginRight: 20,
            border: 'none',
            borderBottom: `2px solid ${active === it.value ? 'var(--accent)' : 'transparent'}`,
            background: 'none',
            color: active === it.value ? 'var(--ink)' : 'var(--ink-2)',
            fontWeight: 600,
            fontSize: 'var(--fs-sm)',
            cursor: 'pointer',
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
