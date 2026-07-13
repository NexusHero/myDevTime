import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calendar heatmap for intensity (ux-vision §2.5) — every cell clickable in product (auditability as UX).
 *  Animates: cells fade/scale in as a wave, column by column. */
export function Heatmap({ weeks = 12, data, color = 'var(--accent)' }) {
  const cells = React.useMemo(
    () => data || Array.from({ length: weeks * 7 }, () => Math.random()),
    [data, weeks]
  );
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gap: 3 }}>
      {cells.map((v, i) => (
        <div
          key={i}
          style={{
            width: 11, height: 11, borderRadius: 3, background: color,
            opacity: mounted ? 0.12 + v * 0.85 : 0,
            transform: mounted ? 'scale(1)' : 'scale(0.4)',
            transition: `opacity var(--dur-med) var(--ease-out) ${Math.floor(i / 7) * 28}ms, transform var(--dur-med) var(--ease-out) ${Math.floor(i / 7) * 28}ms`,
          }}
        />
      ))}
    </div>
  );
}
