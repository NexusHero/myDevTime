import React from 'react'

/** Calendar heatmap for intensity (ux-vision §2.5) — every cell clickable in product (auditability as UX). */
export function Heatmap({ weeks = 12, data, color = 'var(--accent)' }) {
  const cells = data || Array.from({ length: weeks * 7 }, () => Math.random())
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(7, 1fr)',
        gridAutoFlow: 'column',
        gap: 3,
      }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 3,
            background: color,
            opacity: 0.12 + v * 0.85,
          }}
        />
      ))}
    </div>
  )
}
