import React from 'react';

/**
 * The Island (ux-vision §2.3) — one persistent, glanceable pill carrying
 * live state (running timer + punch status). Collapsed by default; expands
 * to quick actions on click. Morphs (not swaps) between states.
 *
 * Two postures:
 * - `floating` (default): free pill, bottom-center — the PHONE posture
 *   (thumb-reachable, above the tab bar).
 * - `docked`: full-width status slot for the DESKTOP sidebar footer —
 *   never overlaps the working surface; glows live-orange while running.
 */
export function Island({ running = true, elapsed = '00:42:11', punched = true, expanded = false, onToggle, actions = [], posture = 'floating' }) {
  const docked = posture === 'docked';
  return (
    <div
      onClick={onToggle}
      style={{
        display: docked ? 'flex' : 'inline-flex',
        flexDirection: 'column',
        gap: expanded ? 10 : 0,
        background: 'var(--canvas-900, #0f1318)',
        color: '#fff',
        borderRadius: docked ? 14 : (expanded ? 'var(--radius-xl)' : 'var(--radius-pill)'),
        padding: docked ? '12px 14px' : (expanded ? 16 : '10px 18px'),
        boxShadow: docked
          ? (running ? '0 0 0 1.5px var(--live-border), 0 8px 24px -10px rgba(255,83,32,0.45)' : 'var(--shadow-md)')
          : 'var(--shadow-lg)',
        cursor: 'pointer',
        width: docked ? '100%' : undefined,
        boxSizing: 'border-box',
        transition: `border-radius var(--dur-med) var(--ease-spring), padding var(--dur-med) var(--ease-spring), box-shadow var(--dur-med) var(--ease-out)`,
        minWidth: !docked && expanded ? 220 : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: running ? 'var(--live, var(--accent))' : 'var(--ink-3, #666)', boxShadow: running ? '0 0 0 4px var(--live-soft, rgba(255,83,32,0.2))' : 'none' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>{punched ? 'Eingestempelt' : 'Ausgestempelt'}</span>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <button key={a.label} onClick={(e) => { e.stopPropagation(); a.onClick && a.onClick(); }} style={{ flex: '1 1 auto', minWidth: 76, padding: '8px 10px', borderRadius: 'var(--radius-pill)', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 'var(--fs-2xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
