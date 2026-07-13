import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Budget ring — project consumption at a glance, warn/crit thresholds at 80/100%.
 *  Animates: ring draws in from 0 on mount, percent counts up in sync. */
export function BudgetRing({ percent = 62, size = 72, color = 'var(--project-1)' }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(percent, 100);
  const tone = percent >= 100 ? 'var(--crit)' : percent >= 80 ? 'var(--warn)' : color;
  const [shown, setShown] = React.useState(reduced() ? percent : 0);
  React.useEffect(() => {
    if (reduced()) { setShown(percent); return; }
    let raf, start;
    const dur = 800;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(percent * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [percent]);
  const shownClamped = Math.min(shown, 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunk)" strokeWidth="7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (shownClamped / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-mono)" fontSize={size * 0.22} fill="var(--ink)" fontWeight="600">{Math.round(shown)}%</text>
    </svg>
  );
}
