import React from 'react';

/** Overtime balance gauge — positive/negative around zero. */
export function OvertimeGauge({ hours = 4.5, max = 20 }) {
  const pct = Math.max(-1, Math.min(1, hours / max));
  const isPositive = hours >= 0;
  const width = Math.abs(pct) * 50;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 220 }}>
      <div style={{ position: 'relative', height: 10, background: 'var(--surface-sunk)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border-strong)' }} />
        <div
          style={{
            position: 'absolute', top: 0, bottom: 0,
            left: isPositive ? '50%' : `${50 - width}%`,
            width: `${width}%`,
            background: isPositive ? 'var(--good)' : 'var(--crit)',
            borderRadius: 'var(--radius-pill)',
            transition: 'all var(--dur-slow) var(--ease-out)',
          }}
        />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: isPositive ? 'var(--good)' : 'var(--crit)' }}>
        {isPositive ? '+' : ''}{hours.toFixed(1)}h
      </div>
    </div>
  );
}
