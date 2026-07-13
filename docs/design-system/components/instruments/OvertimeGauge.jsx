import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Overtime balance gauge — positive/negative around zero.
 *  Animates: bar grows out from the zero line on mount, hours count up. */
export function OvertimeGauge({ hours = 4.5, max = 20 }) {
  const [shown, setShown] = React.useState(reduced() ? hours : 0);
  React.useEffect(() => {
    if (reduced()) { setShown(hours); return; }
    let raf, start;
    const dur = 800;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(hours * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hours]);
  const pct = Math.max(-1, Math.min(1, shown / max));
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
          }}
        />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: isPositive ? 'var(--good)' : 'var(--crit)' }}>
        {isPositive ? '+' : ''}{shown.toFixed(1)}h
      </div>
    </div>
  );
}
