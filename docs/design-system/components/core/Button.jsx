import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
}) {
  const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 22px' : '9px 18px';
  const fontSize = size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)';

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : 'auto',
    padding: pad,
    fontFamily: 'var(--font-ui)',
    fontSize,
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`,
  };

  const variants = {
    primary: { background: 'var(--accent)', color: 'var(--accent-contrast)' },
    secondary: { background: 'var(--surface-raised)', color: 'var(--ink)', border: '1px solid var(--border-strong)' },
    ghost: { background: 'transparent', color: 'var(--ink-2)' },
    danger: { background: 'var(--crit)', color: '#ffffff' },
  };

  const style = { ...base, ...variants[variant] };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={style}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {icon}
      {children}
    </button>
  );
}
