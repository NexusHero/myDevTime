import React from 'react';

/**
 * A single block on the Day Canvas. `kind="actual"` is solid and project-
 * colored (reality); `kind="ghost"` is the Co-Planner's dashed proposal
 * (plan) — never a full color fill, always visually distinct (ux-vision
 * §2.2, §4: "AI output is always visually distinct... never moves data by
 * itself"). `kind="meeting"` pins a fixed calendar event.
 */
export function DayBlock({ label, time, kind = 'actual', color = 'var(--project-1)', height = 64, onAccept, onDismiss }) {
  const isGhost = kind === 'ghost';
  const isMeeting = kind === 'meeting';

  const base = {
    height,
    borderRadius: 'var(--radius-block)',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    transition: `transform var(--dur-med) var(--ease-spring)`,
  };

  const style = isGhost
    ? { ...base, background: 'transparent', border: `1.5px dashed ${color}`, opacity: 0.85 }
    : isMeeting
    ? { ...base, background: 'var(--surface-raised)', border: '1px solid var(--border-strong)', borderLeft: `3px solid ${color}` }
    : { ...base, background: color, color: '#fff' };

  return (
    <div style={style}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: isGhost ? color : isMeeting ? 'var(--ink)' : '#fff' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: isGhost ? color : isMeeting ? 'var(--ink-2)' : 'rgba(255,255,255,0.85)' }}>{time}</div>
      {isGhost && (
        <div style={{ position: 'absolute', top: 6, right: 8, display: 'flex', gap: 4 }}>
          <button onClick={onAccept} title="Accept" style={{ width: 20, height: 20, borderRadius: '50%', border: 'none', background: color, color: '#fff', cursor: 'pointer', fontSize: 11, lineHeight: '20px' }}>✓</button>
          <button onClick={onDismiss} title="Dismiss" style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${color}`, background: 'transparent', color, cursor: 'pointer', fontSize: 11, lineHeight: '18px' }}>✕</button>
        </div>
      )}
    </div>
  );
}
