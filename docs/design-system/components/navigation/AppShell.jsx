import React from 'react'
import { Icon } from '../core/Icon'

/**
 * The app shell (ux-vision §3 IA). `posture="sidebar"` renders the floating
 * light nav rail (follows data-mode; Blueprint overrides to its fixed dark
 * ink shell via --rail-* tokens). `posture="tabs"` renders the five phone
 * tabs with a pill active state. Matches @mydevtime/design's chromeForWidth /
 * PHONE_TABS / SIDEBAR_ITEMS 1:1.
 */
export function AppShell({ posture = 'sidebar', items, active, onNavigate, children }) {
  const list =
    items ||
    (posture === 'sidebar'
      ? ['today', 'planner', 'projects', 'reports', 'meetings', 'assistant', 'profile']
      : ['today', 'planner', 'projects', 'reports', 'profile'])
  const labels = {
    today: 'Today',
    planner: 'Planner',
    projects: 'Projects',
    reports: 'Reports',
    meetings: 'Meetings',
    assistant: 'Assistant',
    profile: 'Profile',
  }

  if (posture === 'tabs') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: 'var(--bg)',
        }}
      >
        <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
        <div
          style={{
            display: 'flex',
            height: 'var(--app-tabbar-h)',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-raised)',
            padding: '6px 8px',
            boxSizing: 'border-box',
            gap: 4,
          }}
        >
          {list.map(id => (
            <button
              key={id}
              onClick={() => onNavigate && onNavigate(id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                background: active === id ? 'var(--accent-soft)' : 'none',
                color: active === id ? 'var(--accent-strong)' : 'var(--ink-3)',
                transition:
                  'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
              }}
            >
              <Icon name={id} />
              <span style={{ fontSize: 10, fontWeight: 600 }}>{labels[id]}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const itemStyle = id => ({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    background: active === id ? 'var(--rail-item-active, var(--accent-soft))' : 'transparent',
    color:
      active === id
        ? 'var(--rail-ink-active, var(--accent-strong))'
        : 'var(--rail-ink, var(--ink-2))',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    transition:
      'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
  })

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <div
        style={{
          width: 'var(--app-sidebar-width)',
          flexShrink: 0,
          padding: 12,
          boxSizing: 'border-box',
          display: 'flex',
        }}
      >
        <nav
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            padding: '16px 10px',
            background: 'var(--rail-bg, var(--surface))',
            border: '1px solid var(--rail-border, var(--border))',
            borderRadius: 20,
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px 18px',
              color: 'var(--rail-brand-ink, var(--ink))',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 256 256" style={{ flexShrink: 0 }}>
              <rect width="256" height="256" rx="60" fill="#3654E0" />
              <rect x="46" y="94" width="64" height="76" rx="18" fill="#ffffff" />
              <rect x="146" y="94" width="64" height="76" rx="18" fill="#ffffff" opacity="0.38" />
              <rect x="121" y="72" width="14" height="112" rx="7" fill="#FF5320" />
              <circle cx="128" cy="54" r="16" fill="#FF5320" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>
              myDevTime
            </span>
          </div>
          {list.map(id => (
            <button
              key={id}
              onClick={() => onNavigate && onNavigate(id)}
              style={itemStyle(id)}
              onMouseEnter={e => {
                if (active !== id)
                  e.currentTarget.style.background =
                    'var(--rail-item-hover, color-mix(in srgb, var(--ink) 6%, transparent))'
              }}
              onMouseLeave={e => {
                if (active !== id) e.currentTarget.style.background = 'transparent'
              }}
            >
              {id === 'assistant' ? (
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: 'var(--ai-grad)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginLeft: -1,
                  }}
                >
                  <Icon name="assistant" size={14} />
                </span>
              ) : (
                <Icon name={id} />
              )}
              {labels[id]}
              {active === id && (
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--live)',
                    flexShrink: 0,
                  }}
                ></span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  )
}
