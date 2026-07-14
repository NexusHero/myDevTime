import React from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Load meter — weekly strain on a green→amber→red scale, fed by
 * deterministic signals (overtime trend, skipped breaks, late sessions,
 * meeting share). The needle position is a computed score; the signals
 * below are the auditable "why". Never call it a diagnosis — it's drift
 * made visible, for your body instead of your plan.
 * Animates: fill + needle sweep up from 0, score counts up, zone label
 * passes through the zones on the way.
 */
export function LoadMeter({ score = 42, label, width = 300 }) {
  const W = width, H = 46, PAD = 4, TRACK_Y = 18, TH = 10;
  const [shown, setShown] = React.useState(reduced() ? score : 0);
  React.useEffect(() => {
    if (reduced()) { setShown(score); return; }
    let raf, start;
    const dur = 1000;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const x = PAD + (Math.min(Math.max(shown, 0), 100) / 100) * (W - PAD * 2);
  const zone = shown < 45 ? 'ok' : shown < 70 ? 'elevated' : 'critical';
  const zoneColor = zone === 'ok' ? 'var(--good)' : zone === 'elevated' ? 'var(--warn)' : 'var(--bad)';
  const zoneLabel = label || (zone === 'ok' ? 'Im grünen Bereich' : zone === 'elevated' ? 'Erhöht' : 'Kritisch');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
        <defs>
          <linearGradient id="dt-load-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--good)" />
            <stop offset="0.45" stopColor="var(--good)" />
            <stop offset="0.62" stopColor="var(--warn)" />
            <stop offset="0.85" stopColor="var(--bad)" />
            <stop offset="1" stopColor="var(--bad)" />
          </linearGradient>
        </defs>
        <rect x={PAD} y={TRACK_Y} width={W - PAD * 2} height={TH} rx={TH / 2} fill="url(#dt-load-grad)" opacity="0.28" />
        <rect x={PAD} y={TRACK_Y} width={Math.max(x - PAD, TH)} height={TH} rx={TH / 2} fill="url(#dt-load-grad)" />
        {/* zone ticks */}
        <line x1={PAD + 0.45 * (W - PAD * 2)} y1={TRACK_Y - 3} x2={PAD + 0.45 * (W - PAD * 2)} y2={TRACK_Y + TH + 3} stroke="var(--border-strong)" strokeWidth="1" />
        <line x1={PAD + 0.7 * (W - PAD * 2)} y1={TRACK_Y - 3} x2={PAD + 0.7 * (W - PAD * 2)} y2={TRACK_Y + TH + 3} stroke="var(--border-strong)" strokeWidth="1" />
        {/* needle */}
        <circle cx={x} cy={TRACK_Y + TH / 2} r="8" fill="var(--surface)" stroke={zoneColor} strokeWidth="3" />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', color: zoneColor, transition: 'color var(--dur-med) var(--ease-out)' }}>{zoneLabel}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(shown)}/100</span>
      </div>
    </div>
  );
}
