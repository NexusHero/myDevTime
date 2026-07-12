import React from 'react';

export function Badge({ children, tone = 'neutral', size = 'md' }) {
  const tones = {
    neutral: { background: 'var(--surface-sunk)', color: 'var(--ink-2)' },
    accent: { background: 'var(--accent-soft)', color: 'var(--accent-strong)' },
    good: { background: 'var(--good-soft)', color: 'var(--good)' },
    crit: { background: 'var(--crit-soft)', color: 'var(--crit)' },
    warn: { background: 'var(--warn-soft)', color: 'var(--warn)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: size === 'sm' ? '2px 8px' : '4px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: size === 'sm' ? 'var(--fs-2xs)' : 'var(--fs-xs)',
        fontWeight: 600,
        lineHeight: 1,
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}
