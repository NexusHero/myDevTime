import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Box plot — distribution of daily working hours (min/Q1/median/Q3/max) with the daily target as a marker. Reads at a glance where your typical day lands vs. Soll.
 *  Animates: the box grows outward from the median, whiskers extend after, the Soll marker drops in last. */
export function BoxPlot({ min = 6.2, q1 = 7.5, median = 8.4, q3 = 9.2, max = 10.75, target = 8.33, lo, hi, width = 300, color = 'var(--accent)' }) {
  const LO = lo != null ? lo : Math.floor(Math.min(min, target) - 0.5);
  const HI = hi != null ? hi : Math.ceil(Math.max(max, target) + 0.5);
  const W = width, H = 74, PAD = 8, TRACK_Y = 30;
  const x = (v) => PAD + ((v - LO) / (HI - LO)) * (W - PAD * 2);
  const fmt = (v) => Math.floor(v) + ':' + String(Math.round((v % 1) * 60)).padStart(2, '0');
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  const boxAnim = {
    transform: mounted ? 'scaleX(1)' : 'scaleX(0)',
    transformOrigin: x(median) + 'px ' + TRACK_Y + 'px',
    transition: 'transform var(--dur-slow) var(--ease-spring)',
  };
  const lateAnim = (delay) => ({
    opacity: mounted ? 1 : 0,
    transition: 'opacity var(--dur-med) var(--ease-out) ' + delay + 'ms',
  });
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
      {/* whiskers — extend after the box */}
      <g style={lateAnim(260)}>
        <line x1={x(min)} y1={TRACK_Y} x2={x(q1)} y2={TRACK_Y} stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1={x(q3)} y1={TRACK_Y} x2={x(max)} y2={TRACK_Y} stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1={x(min)} y1={TRACK_Y - 7} x2={x(min)} y2={TRACK_Y + 7} stroke="var(--border-strong)" strokeWidth="1.5" />
        <line x1={x(max)} y1={TRACK_Y - 7} x2={x(max)} y2={TRACK_Y + 7} stroke="var(--border-strong)" strokeWidth="1.5" />
      </g>
      {/* box — grows outward from the median */}
      <g style={boxAnim}>
        <rect x={x(q1)} y={TRACK_Y - 12} width={x(q3) - x(q1)} height={24} rx="6"
          fill={'color-mix(in srgb, ' + color + ' 16%, var(--surface))'} stroke={color} strokeWidth="1.5" />
      </g>
      {/* median — visible from the first frame: the anchor everything grows from */}
      <line x1={x(median)} y1={TRACK_Y - 12} x2={x(median)} y2={TRACK_Y + 12} stroke={color} strokeWidth="2.5" />
      {/* target (Soll) — always the live orange; drops in last */}
      <g style={lateAnim(420)}>
        <line x1={x(target)} y1={TRACK_Y - 18} x2={x(target)} y2={TRACK_Y + 18} stroke="var(--live)" strokeWidth="2" strokeDasharray="4 3" />
        <circle cx={x(target)} cy={TRACK_Y - 21} r="3.5" fill="var(--live)" />
        <text x={x(target)} y={TRACK_Y - 26} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fontWeight="600" fill="var(--live)">Soll {fmt(target)}</text>
      </g>
      {/* labels */}
      <g style={lateAnim(320)}>
        <text x={x(min)} y={TRACK_Y + 26} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-3)">{fmt(min)}</text>
        <text x={x(median)} y={TRACK_Y + 26} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fontWeight="700" fill="var(--ink)">{fmt(median)}</text>
        <text x={x(max)} y={TRACK_Y + 26} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--ink-3)">{fmt(max)}</text>
      </g>
    </svg>
  );
}
