import React from 'react';
import { Icon } from '../core/Icon';

/**
 * Weekly 2-question check-in (OLBI-short-form style): exhaustion +
 * detachment on a 5-step scale, 10 seconds total. Self-report is the
 * scientifically honest complement to the passive LoadMeter signals —
 * the AI correlates both, it never infers feelings from data alone.
 */
export function CheckinCard({ onDone, compact = false }) {
  const [a1, setA1] = React.useState(null);
  const [a2, setA2] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const QUESTIONS = [
    ['Wie erschöpft warst du diese Woche?', a1, setA1, ['Gar nicht', 'Sehr']],
    ['Konntest du nach Feierabend abschalten?', a2, setA2, ['Immer', 'Nie']],
  ];
  const submit = () => { setDone(true); if (onDone) onDone({ exhaustion: a1, detachment: a2 }); };

  if (done) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '12px 14px' : '14px 18px', borderRadius: 'var(--radius-card)', background: 'var(--good-soft)', color: 'var(--good)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
        <Icon name="check" size={16} />
        Check-in gespeichert — fließt in deinen Balance-Trend ein.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: compact ? '2px 0' : 0 }}>
      {QUESTIONS.map(([q, val, set, [lo, hi]]) => (
        <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--ink)' }}>{q}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', width: 52 }}>{lo}</span>
            <div style={{ display: 'flex', gap: 5, flex: 1, maxWidth: 220 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => set(n)} aria-label={q + ' — ' + n + ' von 5'} style={{
                  flex: 1, height: 30, borderRadius: 8, cursor: 'pointer',
                  border: '1.5px solid ' + (val === n ? 'var(--accent)' : 'var(--border)'),
                  background: val === n ? 'var(--accent-soft)' : 'var(--surface)',
                  color: val === n ? 'var(--accent-strong)' : 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}>{n}</button>
              ))}
            </div>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', width: 52, textAlign: 'right' }}>{hi}</span>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={submit} disabled={a1 === null || a2 === null} style={{
          border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 18px', fontSize: 'var(--fs-xs)', fontWeight: 700,
          background: a1 !== null && a2 !== null ? 'var(--accent)' : 'var(--surface-sunk)',
          color: a1 !== null && a2 !== null ? 'var(--accent-contrast)' : 'var(--ink-3)',
          cursor: a1 !== null && a2 !== null ? 'pointer' : 'default',
          transition: 'all var(--dur-fast) var(--ease-out)',
        }}>Speichern</button>
        <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>10 Sekunden · bleibt auf deinem Gerät</span>
      </div>
    </div>
  );
}
