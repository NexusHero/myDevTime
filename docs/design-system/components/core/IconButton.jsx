import React from 'react';

export function IconButton({ icon, label, size = 'md', variant = 'ghost', active = false, onClick }) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 44 : 38;
  const variants = {
    ghost: { background: active ? 'var(--accent-soft)' : 'transparent', color: active ? 'var(--accent-strong)' : 'var(--ink-2)' },
    filled: { background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--border)' },
  };
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: dim,
        height: dim,
        minWidth: 44,
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
        ...variants[variant],
      }}
    >
      {icon}
    </button>
  );
}
