import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Small-multiple week sparkline — daily hours, no axes/labels, instrument-like.
 *  Animates: bars grow up from the baseline with a small left-to-right stagger. */
export function WeekSparkline({ values = [6, 7.5, 8, 5, 7, 2, 0], color = 'var(--accent)', width = 180, height = 40 }) {
  const max = Math.max(...values, 1);
  const barW = width / values.length - 4;
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = (v / max) * (height - 4);
        return (
          <rect
            key={i} x={i * (barW + 4)} y={height - h} width={barW} height={h} rx={2}
            fill={color} opacity={v === 0 ? 0.15 : 1}
            style={{
              transform: mounted ? 'scaleY(1)' : 'scaleY(0)',
              transformOrigin: `${i * (barW + 4) + barW / 2}px ${height}px`,
              transition: `transform var(--dur-slow) var(--ease-spring) ${i * 45}ms`,
            }}
          />
        );
      })}
    </svg>
  );
}
