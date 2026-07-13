import React from 'react';

/**
 * Leave balance — the vacation account at a glance: big remaining number
 * (mono, tabular) over a segmented year bar (taken → planned → remaining).
 * Numbers are the product: no ring metaphor here — days are discrete,
 * so the bar is discrete-feeling and every segment is labeled.
 */
export function LeaveBalance({ entitlement = 30, taken = 0, planned = 0, carryover = 0, label = 'Urlaub', unit = 'Tage' }) {
  const total = entitlement + carryover;
  const rest = Math.max(0, total - taken - planned);
  const [mounted, setMounted] = React.useState(
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  React.useEffect(() => {
    if (mounted) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  const pct = (n) => (total > 0 && mounted ? (n / total) * 100 : 0) + '%';
  const seg = (w, bg, extra) => ({ width: w, background: bg, transition: 'width var(--dur-slow) var(--ease-out)', ...extra });
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-3xl, 34px)', fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{rest}</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>{unit} {label} übrig</span>
        {carryover > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>inkl. {carryover} Übertrag</span>
        )}
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 'var(--radius-pill)', overflow: 'hidden', gap: 2, background: 'var(--surface-sunk)' }}>
        {taken > 0 && <span style={seg(pct(taken), 'var(--accent)')}></span>}
        {planned > 0 && <span style={seg(pct(planned), 'color-mix(in srgb, var(--accent) 45%, var(--surface))', { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in srgb, var(--accent) 30%, transparent) 4px 8px)' })}></span>}
        <span style={{ flex: 1 }}></span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--accent)' }}></span>Genommen <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{taken}</b></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'color-mix(in srgb, var(--accent) 45%, var(--surface))', border: '1px solid var(--accent)', boxSizing: 'border-box' }}></span>Verplant <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{planned}</b></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--surface-sunk)', border: '1px solid var(--border-strong)', boxSizing: 'border-box' }}></span>Anspruch <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{total}</b></span>
      </div>
    </div>
  );
}
