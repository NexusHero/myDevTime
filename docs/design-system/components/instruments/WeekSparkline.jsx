import React from 'react'

/** Small-multiple week sparkline — daily hours, no axes/labels, instrument-like. */
export function WeekSparkline({
  values = [6, 7.5, 8, 5, 7, 2, 0],
  color = 'var(--accent)',
  width = 180,
  height = 40,
}) {
  const max = Math.max(...values, 1)
  const barW = width / values.length - 4
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {values.map((v, i) => {
        const h = (v / max) * (height - 4)
        return (
          <rect
            key={i}
            x={i * (barW + 4)}
            y={height - h}
            width={barW}
            height={h}
            rx={2}
            fill={color}
            opacity={v === 0 ? 0.15 : 1}
          />
        )
      })}
    </svg>
  )
}
