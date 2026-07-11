import React from 'react'

/** Budget ring — project consumption at a glance, warn/crit thresholds at 80/100%. */
export function BudgetRing({ percent = 62, size = 72, color = 'var(--project-1)' }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(percent, 100)
  const tone = percent >= 100 ? 'var(--crit)' : percent >= 80 ? 'var(--warn)' : color
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-sunk)"
        strokeWidth="7"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (clamped / 100) * c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset var(--dur-slow) var(--ease-out)' }}
      />
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-mono)"
        fontSize={size * 0.22}
        fill="var(--ink)"
        fontWeight="600"
      >
        {percent}%
      </text>
    </svg>
  )
}
