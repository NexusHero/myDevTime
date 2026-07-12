import React from 'react';
import { Icon } from '../core/Icon';

/**
 * One-tap momentary mood signal (EMA-style): Gut / Angespannt / Gestresst.
 * Lives on Today — one tap, collapses to a quiet confirmation, feeds the
 * Balance trend as a timestamped point next to the passive signals.
 * Never more than one prompt per day; never blocks anything.
 */
export function MoodCheck({ onSelect, question = 'Wie fühlst du dich gerade?' }) {
  const [picked, setPicked] = React.useState(null);
  const OPTIONS = [
    ['gut', 'Gut', 'var(--good)', 'var(--good-soft)'],
    ['angespannt', 'Angespannt', 'var(--warn)', 'var(--warn-soft)'],
    ['gestresst', 'Gestresst', 'var(--bad)', 'var(--bad-soft)'],
  ];
  const pick = (id) => { setPicked(id); if (onSelect) onSelect(id); };

  if (picked) {
    const opt = OPTIONS.find(([id]) => id === picked);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 'var(--radius-pill)', background: opt[3], color: opt[2], fontSize: 'var(--fs-2xs)', fontWeight: 600 }}>
        <Icon name="check" size={13} />
        Notiert — fließt in deinen Balance-Trend ein.
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-2)', fontWeight: 600 }}>{question}</span>
      <span style={{ display: 'inline-flex', gap: 5 }}>
        {OPTIONS.map(([id, label, color, soft]) => (
          <button
            key={id}
            onClick={() => pick(id)}
            style={{
              border: '1.5px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '4px 12px',
              fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = soft; e.currentTarget.style.color = color; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--ink-2)'; }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }}></span>
            {label}
          </button>
        ))}
      </span>
    </span>
  );
}
