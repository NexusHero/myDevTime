/* @ds-bundle: {"format":4,"namespace":"MyDevTimeDesignSystem_254296","components":[{"name":"DayBlock","sourcePath":"components/canvas/DayBlock.jsx"},{"name":"Island","sourcePath":"components/canvas/Island.jsx"},{"name":"AIAskBar","sourcePath":"components/core/AIAskBar.jsx"},{"name":"AICallout","sourcePath":"components/core/AICallout.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"ICON_PATHS","sourcePath":"components/core/Icon.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"BoxPlot","sourcePath":"components/instruments/BoxPlot.jsx"},{"name":"BudgetRing","sourcePath":"components/instruments/BudgetRing.jsx"},{"name":"CheckinCard","sourcePath":"components/instruments/CheckinCard.jsx"},{"name":"Heatmap","sourcePath":"components/instruments/Heatmap.jsx"},{"name":"LeaveBalance","sourcePath":"components/instruments/LeaveBalance.jsx"},{"name":"LoadMeter","sourcePath":"components/instruments/LoadMeter.jsx"},{"name":"MoodCheck","sourcePath":"components/instruments/MoodCheck.jsx"},{"name":"OvertimeGauge","sourcePath":"components/instruments/OvertimeGauge.jsx"},{"name":"StatTile","sourcePath":"components/instruments/StatTile.jsx"},{"name":"WeekSparkline","sourcePath":"components/instruments/WeekSparkline.jsx"},{"name":"AppShell","sourcePath":"components/navigation/AppShell.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/canvas/DayBlock.jsx":"581223e49c4b","components/canvas/Island.jsx":"7f75f2af8daf","components/core/AIAskBar.jsx":"e9b6199ed917","components/core/AICallout.jsx":"7c16d9719ae3","components/core/Badge.jsx":"22e1a037c7fa","components/core/Button.jsx":"88aa1f22fb92","components/core/Card.jsx":"9c3befd92c7a","components/core/EmptyState.jsx":"de99a7534fd3","components/core/Icon.jsx":"ecc3805a5467","components/core/IconButton.jsx":"bd1bf2e65af6","components/forms/Checkbox.jsx":"fb9bfcd68f0d","components/forms/Input.jsx":"f7f21705416e","components/forms/Select.jsx":"086d9b22b998","components/forms/Switch.jsx":"fa514ce5dec7","components/instruments/BoxPlot.jsx":"e158418e08e4","components/instruments/BudgetRing.jsx":"b245e30fba61","components/instruments/CheckinCard.jsx":"ba384765a9c4","components/instruments/Heatmap.jsx":"f710a9f514c8","components/instruments/LeaveBalance.jsx":"7bed514962e9","components/instruments/LoadMeter.jsx":"34d1950f1ebe","components/instruments/MoodCheck.jsx":"d0682f291403","components/instruments/OvertimeGauge.jsx":"c471464fbce5","components/instruments/StatTile.jsx":"d144b3a330f8","components/instruments/WeekSparkline.jsx":"07fa6ad6b1d0","components/navigation/AppShell.jsx":"a86242188aec","components/navigation/Tabs.jsx":"836ca05f5898","ui_kits/devtime/AbsenceScreen.jsx":"96c9d21f985e","ui_kits/devtime/AssistantScreen.jsx":"50605918e171","ui_kits/devtime/MeetingsScreen.jsx":"8941603d3800","ui_kits/devtime/OnboardingFlow.jsx":"4e3374a8296d","ui_kits/devtime/PlannerScreen.jsx":"b8f9576beff9","ui_kits/devtime/PlannerViews.jsx":"c58b84c229a3","ui_kits/devtime/ProfileScreen.jsx":"30a05b62fe93","ui_kits/devtime/ProjectsScreen.jsx":"d079ec94857d","ui_kits/devtime/ReportsScreen.jsx":"a4779f05c7b2","ui_kits/devtime/TodayScreen.jsx":"1d48a0b16e89","ui_kits/devtime/app.jsx":"c6c9c5775965","ui_kits/devtime/phone.jsx":"c549225d33e0"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MyDevTimeDesignSystem_254296 = window.MyDevTimeDesignSystem_254296 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/canvas/DayBlock.jsx
try { (() => {
/**
 * A single block on the Day Canvas. `kind="actual"` is solid and project-
 * colored (reality); `kind="ghost"` is the Co-Planner's dashed proposal
 * (plan) — never a full color fill, always visually distinct (ux-vision
 * §2.2, §4: "AI output is always visually distinct... never moves data by
 * itself"). `kind="meeting"` pins a fixed calendar event.
 */
function DayBlock({
  label,
  time,
  kind = 'actual',
  color = 'var(--project-1)',
  height = 64,
  onAccept,
  onDismiss
}) {
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
    transition: `transform var(--dur-med) var(--ease-spring)`
  };
  const style = isGhost ? {
    ...base,
    background: 'transparent',
    border: `1.5px dashed ${color}`,
    opacity: 0.85
  } : isMeeting ? {
    ...base,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-strong)',
    borderLeft: `3px solid ${color}`
  } : {
    ...base,
    background: color,
    color: '#fff'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: isGhost ? color : isMeeting ? 'var(--ink)' : '#fff'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: isGhost ? color : isMeeting ? 'var(--ink-2)' : 'rgba(255,255,255,0.85)'
    }
  }, time), isGhost && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 6,
      right: 8,
      display: 'flex',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onAccept,
    title: "Accept",
    style: {
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: 'none',
      background: color,
      color: '#fff',
      cursor: 'pointer',
      fontSize: 11,
      lineHeight: '20px'
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("button", {
    onClick: onDismiss,
    title: "Dismiss",
    style: {
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: `1px solid ${color}`,
      background: 'transparent',
      color,
      cursor: 'pointer',
      fontSize: 11,
      lineHeight: '18px'
    }
  }, "\u2715")));
}
Object.assign(__ds_scope, { DayBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/DayBlock.jsx", error: String((e && e.message) || e) }); }

// components/canvas/Island.jsx
try { (() => {
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
function Island({
  running = true,
  elapsed = '00:42:11',
  punched = true,
  expanded = false,
  onToggle,
  actions = [],
  posture = 'floating'
}) {
  const docked = posture === 'docked';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    style: {
      display: docked ? 'flex' : 'inline-flex',
      flexDirection: 'column',
      gap: expanded ? 10 : 0,
      background: 'var(--canvas-900, #0f1318)',
      color: '#fff',
      borderRadius: docked ? 14 : expanded ? 'var(--radius-xl)' : 'var(--radius-pill)',
      padding: docked ? '12px 14px' : expanded ? 16 : '10px 18px',
      boxShadow: docked ? running ? '0 0 0 1.5px var(--live-border), 0 8px 24px -10px rgba(255,83,32,0.45)' : 'var(--shadow-md)' : 'var(--shadow-lg)',
      cursor: 'pointer',
      width: docked ? '100%' : undefined,
      boxSizing: 'border-box',
      transition: `border-radius var(--dur-med) var(--ease-spring), padding var(--dur-med) var(--ease-spring), box-shadow var(--dur-med) var(--ease-out)`,
      minWidth: !docked && expanded ? 220 : 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-island-pulse { 0% { box-shadow: 0 0 0 0 var(--live-border, rgba(255,83,32,0.38)); } 70%, 100% { box-shadow: 0 0 0 8px transparent; } } @media (prefers-reduced-motion: reduce) { .dt-island-dot { animation: none !important; } }'), /*#__PURE__*/React.createElement("span", {
    className: running ? 'dt-island-dot' : undefined,
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
      background: running ? 'var(--live, var(--accent))' : 'var(--ink-3, #666)',
      animation: running ? 'dt-island-pulse 2s var(--ease-out, ease-out) infinite' : 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, elapsed), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'rgba(255,255,255,0.55)',
      whiteSpace: 'nowrap'
    }
  }, punched ? 'Eingestempelt' : 'Ausgestempelt')), expanded && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, actions.map(a => /*#__PURE__*/React.createElement("button", {
    key: a.label,
    onClick: e => {
      e.stopPropagation();
      a.onClick && a.onClick();
    },
    style: {
      flex: '1 1 auto',
      minWidth: 76,
      padding: '8px 10px',
      borderRadius: 'var(--radius-pill)',
      border: 'none',
      background: 'rgba(255,255,255,0.1)',
      color: '#fff',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, a.label))));
}
Object.assign(__ds_scope, { Island });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/canvas/Island.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function Badge({
  children,
  tone = 'neutral',
  size = 'md'
}) {
  const tones = {
    neutral: {
      background: 'var(--surface-sunk)',
      color: 'var(--ink-2)'
    },
    accent: {
      background: 'var(--accent-soft)',
      color: 'var(--accent-strong)'
    },
    good: {
      background: 'var(--good-soft)',
      color: 'var(--good)'
    },
    crit: {
      background: 'var(--crit-soft)',
      color: 'var(--crit)'
    },
    warn: {
      background: 'var(--warn-soft)',
      color: 'var(--warn)'
    }
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: size === 'sm' ? '2px 8px' : '4px 10px',
      borderRadius: 'var(--radius-pill)',
      fontSize: size === 'sm' ? 'var(--fs-2xs)' : 'var(--fs-xs)',
      fontWeight: 600,
      lineHeight: 1,
      ...tones[tone]
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button'
}) {
  const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '12px 22px' : '9px 18px';
  const fontSize = size === 'sm' ? 'var(--fs-xs)' : 'var(--fs-sm)';
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: fullWidth ? '100%' : 'auto',
    padding: pad,
    fontFamily: 'var(--font-ui)',
    fontSize,
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: `transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)`
  };
  const variants = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-contrast)'
    },
    secondary: {
      background: 'var(--surface-raised)',
      color: 'var(--ink)',
      border: '1px solid var(--border-strong)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--ink-2)'
    },
    danger: {
      background: 'var(--crit)',
      color: '#ffffff'
    }
  };
  const style = {
    ...base,
    ...variants[variant]
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    style: style,
    onMouseEnter: e => {
      if (!disabled) {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'none';
    }
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  title,
  subtitle,
  action,
  padding = true,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden',
      ...style
    }
  }, (title || action) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 18px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: 'var(--ink)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      marginTop: 2
    }
  }, subtitle)), action), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padding ? 'var(--pad-card)' : 0
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/**
 * The brand icon set — 24px grid, 2px stroke, round caps, currentColor.
 * Hand-built line glyphs matching the construction of the AppShell set;
 * extend HERE (same grid, same stroke) rather than importing a CDN set.
 */
const ICON_PATHS = {
  today: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  timer: 'M12 8.5v4.5l3 2M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  planner: 'M4 6h16M4 12h16M4 18h10',
  absence: 'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM8 7v13M16 7v13',
  projects: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  reports: 'M5 21V9M12 21V3M19 21v-7',
  meetings: 'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6',
  assistant: 'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z',
  settings: 'M4 8h8M17 8h3M4 16h4M12 16h8M14.5 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9.5 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  play: 'M8 5.5v13l10-6.5z',
  pause: 'M9 5v14M15 5v14',
  stop: 'M7.5 7.5h9v9h-9z',
  record: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 19v2',
  break: 'M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 9h2a2.5 2.5 0 0 1 0 5h-2M8 3v2M12 3v2',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  search: 'M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15.5 15.5L21 21',
  export: 'M12 15V3M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  chevronLeft: 'M14 6l-6 6 6 6',
  chevronRight: 'M10 6l6 6-6 6'
};

/** One icon from the brand set. `name` from ICON_PATHS; sizes 16/20/24. */
function Icon({
  name = 'today',
  size = 20,
  strokeWidth = 2,
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: ICON_PATHS[name] || ICON_PATHS.today
  }));
}
Object.assign(__ds_scope, { ICON_PATHS, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/AIAskBar.jsx
try { (() => {
/**
 * The omnipresent "ask your data" bar — AI reachable on EVERY screen, not
 * just the Assistant tab (the awork-class pattern). Gradient hairline =
 * AI signature; scope chips show which data the answer draws from;
 * answers come from deterministic query tools (grounded, read-only).
 */
function AIAskBar({
  placeholder = 'Frag deine Daten …',
  scopes = ['Projekte', 'Zeiten', 'Budgets'],
  answers = {},
  defaultAnswer = 'In dieser Preview beantworte ich die Beispielfragen — im Produkt jede Frage zu deinen Daten. 1 Credit pro Frage.'
}) {
  const [q, setQ] = React.useState('');
  const [asked, setAsked] = React.useState(null);
  const ask = text => {
    if (!text.trim()) return;
    setAsked({
      q: text,
      a: answers[text] || defaultAnswer
    });
    setQ('');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-pill)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-pill) - 1.5px)',
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 10px 9px 14px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 8,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "assistant",
    size: 14
  })), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') ask(q);
    },
    placeholder: placeholder,
    style: {
      flex: 1,
      minWidth: 40,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 5,
      flexShrink: 0
    }
  }, scopes.map(s => /*#__PURE__*/React.createElement("span", {
    key: s,
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--ink-3)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '3px 9px',
      whiteSpace: 'nowrap'
    }
  }, s))), /*#__PURE__*/React.createElement("button", {
    onClick: () => ask(q),
    "aria-label": "Fragen",
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevronRight",
    size: 15
  })))), !asked && Object.keys(answers).length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, Object.keys(answers).map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    onClick: () => ask(s),
    style: {
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '5px 12px',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      background: 'var(--surface)',
      cursor: 'pointer'
    }
  }, s))), asked && /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ai-ink)'
    }
  }, "\u2726 ", asked.q), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink)',
      lineHeight: 'var(--lh-normal)'
    }
  }, asked.a), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 10,
      color: 'var(--ink-3)'
    }
  }, "Zahlen aus der deterministischen Aggregation \xB7 nie aus dem Modell"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAsked(null),
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--ink-3)',
      fontSize: 12,
      cursor: 'pointer',
      padding: 2
    }
  }, "\u2715")))));
}
Object.assign(__ds_scope, { AIAskBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AIAskBar.jsx", error: String((e && e.message) || e) }); }

// components/core/AICallout.jsx
try { (() => {
/**
 * AI callout — the ONE way AI output appears in the product: gradient
 * hairline (blue→orange, --ai-grad), ✦ chip, body text, optional actions.
 * Deterministic UI never wears this treatment (ADR-0005: AI proposes,
 * you decide — the gradient IS that contract, visually).
 */
function AICallout({
  title,
  children,
  action,
  compact = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      padding: compact ? '10px 14px' : '12px 16px',
      display: 'flex',
      gap: 11,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 8,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "assistant",
    size: 15
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      lineHeight: 'var(--lh-normal)'
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)',
      marginBottom: 2
    }
  }, title), children), action && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 8,
      alignItems: 'center',
      flexShrink: 0
    }
  }, action)));
}
Object.assign(__ds_scope, { AICallout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AICallout.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
/**
 * Empty state — calm, useful, never cute: icon in a soft accent disc, one
 * sentence of state, one sentence of next step, optionally one action.
 * (ux-vision §5: trust is the aesthetic — no illustrations, no confetti.)
 */
function EmptyState({
  icon = 'plus',
  title,
  hint,
  action,
  compact = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 10,
      padding: compact ? '22px 18px' : '38px 24px',
      border: '1.5px dashed var(--border-strong)',
      borderRadius: 'var(--radius-xl)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'var(--accent-soft)',
      color: 'var(--accent-strong)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 'var(--fs-md)',
      color: 'var(--ink)'
    }
  }, title), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      maxWidth: 380,
      lineHeight: 'var(--lh-normal)'
    }
  }, hint), action && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  active = false,
  onClick
}) {
  const dim = size === 'sm' ? 32 : size === 'lg' ? 44 : 38;
  const variants = {
    ghost: {
      background: active ? 'var(--accent-soft)' : 'transparent',
      color: active ? 'var(--accent-strong)' : 'var(--ink-2)'
    },
    filled: {
      background: 'var(--surface-raised)',
      color: 'var(--ink)',
      border: '1px solid var(--border)'
    }
  };
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label,
    title: label,
    onClick: onClick,
    style: {
      width: dim,
      height: dim,
      minWidth: 44,
      minHeight: 44,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius-pill)',
      border: 'none',
      cursor: 'pointer',
      transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)',
      ...variants[variant]
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  checked,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
      background: checked ? 'var(--accent)' : 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  mono = false,
  error
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    style: {
      height: 'var(--touch-target)',
      padding: '0 14px',
      borderRadius: 'var(--radius-block)',
      border: `1px solid ${error ? 'var(--crit)' : 'var(--border-strong)'}`,
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      outline: 'none',
      transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    },
    onFocus: e => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
    },
    onBlur: e => {
      e.currentTarget.style.borderColor = error ? 'var(--crit)' : 'var(--border-strong)';
      e.currentTarget.style.boxShadow = 'none';
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--crit)'
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  value,
  onChange,
  options = []
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    style: {
      height: 'var(--touch-target)',
      padding: '0 14px',
      borderRadius: 'var(--radius-block)',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      outline: 'none'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 40,
      height: 24,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--accent)' : 'var(--border-strong)',
      position: 'relative',
      transition: 'background var(--dur-med) var(--ease-out)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 19 : 3,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--dur-med) var(--ease-out)'
    }
  })), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/instruments/BoxPlot.jsx
try { (() => {
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Box plot — distribution of daily working hours (min/Q1/median/Q3/max) with the daily target as a marker. Reads at a glance where your typical day lands vs. Soll.
 *  Animates: the box grows outward from the median, whiskers extend after, the Soll marker drops in last. */
function BoxPlot({
  min = 6.2,
  q1 = 7.5,
  median = 8.4,
  q3 = 9.2,
  max = 10.75,
  target = 8.33,
  lo,
  hi,
  width = 300,
  color = 'var(--accent)'
}) {
  const LO = lo != null ? lo : Math.floor(Math.min(min, target) - 0.5);
  const HI = hi != null ? hi : Math.ceil(Math.max(max, target) + 0.5);
  const W = width,
    H = 74,
    PAD = 8,
    TRACK_Y = 30;
  const x = v => PAD + (v - LO) / (HI - LO) * (W - PAD * 2);
  const fmt = v => Math.floor(v) + ':' + String(Math.round(v % 1 * 60)).padStart(2, '0');
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  const boxAnim = {
    transform: mounted ? 'scaleX(1)' : 'scaleX(0)',
    transformOrigin: x(median) + 'px ' + TRACK_Y + 'px',
    transition: 'transform var(--dur-slow) var(--ease-spring)'
  };
  const lateAnim = delay => ({
    opacity: mounted ? 1 : 0,
    transition: 'opacity var(--dur-med) var(--ease-out) ' + delay + 'ms'
  });
  return /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    style: {
      display: 'block',
      maxWidth: '100%'
    }
  }, /*#__PURE__*/React.createElement("g", {
    style: lateAnim(260)
  }, /*#__PURE__*/React.createElement("line", {
    x1: x(min),
    y1: TRACK_Y,
    x2: x(q1),
    y2: TRACK_Y,
    stroke: "var(--border-strong)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: x(q3),
    y1: TRACK_Y,
    x2: x(max),
    y2: TRACK_Y,
    stroke: "var(--border-strong)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: x(min),
    y1: TRACK_Y - 7,
    x2: x(min),
    y2: TRACK_Y + 7,
    stroke: "var(--border-strong)",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: x(max),
    y1: TRACK_Y - 7,
    x2: x(max),
    y2: TRACK_Y + 7,
    stroke: "var(--border-strong)",
    strokeWidth: "1.5"
  })), /*#__PURE__*/React.createElement("g", {
    style: boxAnim
  }, /*#__PURE__*/React.createElement("rect", {
    x: x(q1),
    y: TRACK_Y - 12,
    width: x(q3) - x(q1),
    height: 24,
    rx: "6",
    fill: 'color-mix(in srgb, ' + color + ' 16%, var(--surface))',
    stroke: color,
    strokeWidth: "1.5"
  })), /*#__PURE__*/React.createElement("line", {
    x1: x(median),
    y1: TRACK_Y - 12,
    x2: x(median),
    y2: TRACK_Y + 12,
    stroke: color,
    strokeWidth: "2.5"
  }), /*#__PURE__*/React.createElement("g", {
    style: lateAnim(420)
  }, /*#__PURE__*/React.createElement("line", {
    x1: x(target),
    y1: TRACK_Y - 18,
    x2: x(target),
    y2: TRACK_Y + 18,
    stroke: "var(--live)",
    strokeWidth: "2",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x(target),
    cy: TRACK_Y - 21,
    r: "3.5",
    fill: "var(--live)"
  }), /*#__PURE__*/React.createElement("text", {
    x: x(target),
    y: TRACK_Y - 26,
    textAnchor: "middle",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fontWeight: "600",
    fill: "var(--live)"
  }, "Soll ", fmt(target))), /*#__PURE__*/React.createElement("g", {
    style: lateAnim(320)
  }, /*#__PURE__*/React.createElement("text", {
    x: x(min),
    y: TRACK_Y + 26,
    textAnchor: "middle",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fill: "var(--ink-3)"
  }, fmt(min)), /*#__PURE__*/React.createElement("text", {
    x: x(median),
    y: TRACK_Y + 26,
    textAnchor: "middle",
    fontFamily: "var(--font-mono)",
    fontSize: "10",
    fontWeight: "700",
    fill: "var(--ink)"
  }, fmt(median)), /*#__PURE__*/React.createElement("text", {
    x: x(max),
    y: TRACK_Y + 26,
    textAnchor: "middle",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fill: "var(--ink-3)"
  }, fmt(max))));
}
Object.assign(__ds_scope, { BoxPlot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/BoxPlot.jsx", error: String((e && e.message) || e) }); }

// components/instruments/BudgetRing.jsx
try { (() => {
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Budget ring — project consumption at a glance, warn/crit thresholds at 80/100%.
 *  Animates: ring draws in from 0 on mount, percent counts up in sync. */
function BudgetRing({
  percent = 62,
  size = 72,
  color = 'var(--project-1)'
}) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(percent, 100);
  const tone = percent >= 100 ? 'var(--crit)' : percent >= 80 ? 'var(--warn)' : color;
  const [shown, setShown] = React.useState(reduced() ? percent : 0);
  React.useEffect(() => {
    if (reduced()) {
      setShown(percent);
      return;
    }
    let raf, start;
    const dur = 800;
    const step = t => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(percent * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [percent]);
  const shownClamped = Math.min(shown, 100);
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`
  }, /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: "var(--surface-sunk)",
    strokeWidth: "7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: tone,
    strokeWidth: "7",
    strokeLinecap: "round",
    strokeDasharray: c,
    strokeDashoffset: c - shownClamped / 100 * c,
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  }), /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "52%",
    textAnchor: "middle",
    dominantBaseline: "middle",
    fontFamily: "var(--font-mono)",
    fontSize: size * 0.22,
    fill: "var(--ink)",
    fontWeight: "600"
  }, Math.round(shown), "%"));
}
Object.assign(__ds_scope, { BudgetRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/BudgetRing.jsx", error: String((e && e.message) || e) }); }

// components/instruments/CheckinCard.jsx
try { (() => {
/**
 * Weekly 2-question check-in (OLBI-short-form style): exhaustion +
 * detachment on a 5-step scale, 10 seconds total. Self-report is the
 * scientifically honest complement to the passive LoadMeter signals —
 * the AI correlates both, it never infers feelings from data alone.
 */
function CheckinCard({
  onDone,
  compact = false
}) {
  const [a1, setA1] = React.useState(null);
  const [a2, setA2] = React.useState(null);
  const [done, setDone] = React.useState(false);
  const QUESTIONS = [['Wie erschöpft warst du diese Woche?', a1, setA1, ['Gar nicht', 'Sehr']], ['Konntest du nach Feierabend abschalten?', a2, setA2, ['Immer', 'Nie']]];
  const submit = () => {
    setDone(true);
    if (onDone) onDone({
      exhaustion: a1,
      detachment: a2
    });
  };
  if (done) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? '12px 14px' : '14px 18px',
        borderRadius: 'var(--radius-card)',
        background: 'var(--good-soft)',
        color: 'var(--good)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 16
    }), "Check-in gespeichert \u2014 flie\xDFt in deinen Balance-Trend ein.");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: compact ? '2px 0' : 0
    }
  }, QUESTIONS.map(([q, val, set, [lo, hi]]) => /*#__PURE__*/React.createElement("div", {
    key: q,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, q), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)',
      width: 52
    }
  }, lo), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      flex: 1,
      maxWidth: 220
    }
  }, [1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    onClick: () => set(n),
    "aria-label": q + ' — ' + n + ' von 5',
    style: {
      flex: 1,
      height: 30,
      borderRadius: 8,
      cursor: 'pointer',
      border: '1.5px solid ' + (val === n ? 'var(--accent)' : 'var(--border)'),
      background: val === n ? 'var(--accent-soft)' : 'var(--surface)',
      color: val === n ? 'var(--accent-strong)' : 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      fontWeight: 700,
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, n))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)',
      width: 52,
      textAlign: 'right'
    }
  }, hi)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: submit,
    disabled: a1 === null || a2 === null,
    style: {
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '8px 18px',
      fontSize: 'var(--fs-xs)',
      fontWeight: 700,
      background: a1 !== null && a2 !== null ? 'var(--accent)' : 'var(--surface-sunk)',
      color: a1 !== null && a2 !== null ? 'var(--accent-contrast)' : 'var(--ink-3)',
      cursor: a1 !== null && a2 !== null ? 'pointer' : 'default',
      transition: 'all var(--dur-fast) var(--ease-out)'
    }
  }, "Speichern"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)'
    }
  }, "10 Sekunden \xB7 bleibt auf deinem Ger\xE4t")));
}
Object.assign(__ds_scope, { CheckinCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/CheckinCard.jsx", error: String((e && e.message) || e) }); }

// components/instruments/Heatmap.jsx
try { (() => {
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Calendar heatmap for intensity (ux-vision §2.5) — every cell clickable in product (auditability as UX).
 *  Animates: cells fade/scale in as a wave, column by column. */
function Heatmap({
  weeks = 12,
  data,
  color = 'var(--accent)'
}) {
  const cells = React.useMemo(() => data || Array.from({
    length: weeks * 7
  }, () => Math.random()), [data, weeks]);
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateRows: 'repeat(7, 1fr)',
      gridAutoFlow: 'column',
      gap: 3
    }
  }, cells.map((v, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: 11,
      height: 11,
      borderRadius: 3,
      background: color,
      opacity: mounted ? 0.12 + v * 0.85 : 0,
      transform: mounted ? 'scale(1)' : 'scale(0.4)',
      transition: `opacity var(--dur-med) var(--ease-out) ${Math.floor(i / 7) * 28}ms, transform var(--dur-med) var(--ease-out) ${Math.floor(i / 7) * 28}ms`
    }
  })));
}
Object.assign(__ds_scope, { Heatmap });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/Heatmap.jsx", error: String((e && e.message) || e) }); }

// components/instruments/LeaveBalance.jsx
try { (() => {
/**
 * Leave balance — the vacation account at a glance: big remaining number
 * (mono, tabular) over a segmented year bar (taken → planned → remaining).
 * Numbers are the product: no ring metaphor here — days are discrete,
 * so the bar is discrete-feeling and every segment is labeled.
 */
function LeaveBalance({
  entitlement = 30,
  taken = 0,
  planned = 0,
  carryover = 0,
  label = 'Urlaub',
  unit = 'Tage'
}) {
  const total = entitlement + carryover;
  const rest = Math.max(0, total - taken - planned);
  const [mounted, setMounted] = React.useState(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(() => {
    if (mounted) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  const pct = n => (total > 0 && mounted ? n / total * 100 : 0) + '%';
  const seg = (w, bg, extra) => ({
    width: w,
    background: bg,
    transition: 'width var(--dur-slow) var(--ease-out)',
    ...extra
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-3xl, 34px)',
      fontWeight: 600,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)'
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, unit, " ", label, " \xFCbrig"), carryover > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "inkl. ", carryover, " \xDCbertrag")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 12,
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      gap: 2,
      background: 'var(--surface-sunk)'
    }
  }, taken > 0 && /*#__PURE__*/React.createElement("span", {
    style: seg(pct(taken), 'var(--accent)')
  }), planned > 0 && /*#__PURE__*/React.createElement("span", {
    style: seg(pct(planned), 'color-mix(in srgb, var(--accent) 45%, var(--surface))', {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in srgb, var(--accent) 30%, transparent) 4px 8px)'
    })
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 10,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: 'var(--accent)'
    }
  }), "Genommen ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, taken)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: 'color-mix(in srgb, var(--accent) 45%, var(--surface))',
      border: '1px solid var(--accent)',
      boxSizing: 'border-box'
    }
  }), "Verplant ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, planned)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: 'var(--surface-sunk)',
      border: '1px solid var(--border-strong)',
      boxSizing: 'border-box'
    }
  }), "Anspruch ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, total))));
}
Object.assign(__ds_scope, { LeaveBalance });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/LeaveBalance.jsx", error: String((e && e.message) || e) }); }

// components/instruments/LoadMeter.jsx
try { (() => {
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
function LoadMeter({
  score = 42,
  label,
  width = 300
}) {
  const W = width,
    H = 46,
    PAD = 4,
    TRACK_Y = 18,
    TH = 10;
  const [shown, setShown] = React.useState(reduced() ? score : 0);
  React.useEffect(() => {
    if (reduced()) {
      setShown(score);
      return;
    }
    let raf, start;
    const dur = 1000;
    const step = t => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(score * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [score]);
  const x = PAD + Math.min(Math.max(shown, 0), 100) / 100 * (W - PAD * 2);
  const zone = shown < 45 ? 'ok' : shown < 70 ? 'elevated' : 'critical';
  const zoneColor = zone === 'ok' ? 'var(--good)' : zone === 'elevated' ? 'var(--warn)' : 'var(--bad)';
  const zoneLabel = label || (zone === 'ok' ? 'Im grünen Bereich' : zone === 'elevated' ? 'Erhöht' : 'Kritisch');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: W,
    height: H,
    viewBox: `0 0 ${W} ${H}`,
    style: {
      display: 'block',
      maxWidth: '100%'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "dt-load-grad",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "0"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "var(--good)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "0.45",
    stopColor: "var(--good)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "0.62",
    stopColor: "var(--warn)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "0.85",
    stopColor: "var(--bad)"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "var(--bad)"
  }))), /*#__PURE__*/React.createElement("rect", {
    x: PAD,
    y: TRACK_Y,
    width: W - PAD * 2,
    height: TH,
    rx: TH / 2,
    fill: "url(#dt-load-grad)",
    opacity: "0.28"
  }), /*#__PURE__*/React.createElement("rect", {
    x: PAD,
    y: TRACK_Y,
    width: Math.max(x - PAD, TH),
    height: TH,
    rx: TH / 2,
    fill: "url(#dt-load-grad)"
  }), /*#__PURE__*/React.createElement("line", {
    x1: PAD + 0.45 * (W - PAD * 2),
    y1: TRACK_Y - 3,
    x2: PAD + 0.45 * (W - PAD * 2),
    y2: TRACK_Y + TH + 3,
    stroke: "var(--border-strong)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("line", {
    x1: PAD + 0.7 * (W - PAD * 2),
    y1: TRACK_Y - 3,
    x2: PAD + 0.7 * (W - PAD * 2),
    y2: TRACK_Y + TH + 3,
    stroke: "var(--border-strong)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: x,
    cy: TRACK_Y + TH / 2,
    r: "8",
    fill: "var(--surface)",
    stroke: zoneColor,
    strokeWidth: "3"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: zoneColor,
      transition: 'color var(--dur-med) var(--ease-out)'
    }
  }, zoneLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, Math.round(shown), "/100")));
}
Object.assign(__ds_scope, { LoadMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/LoadMeter.jsx", error: String((e && e.message) || e) }); }

// components/instruments/MoodCheck.jsx
try { (() => {
/**
 * One-tap momentary mood signal (EMA-style): Gut / Angespannt / Gestresst.
 * Lives on Today — one tap, collapses to a quiet confirmation, feeds the
 * Balance trend as a timestamped point next to the passive signals.
 * Never more than one prompt per day; never blocks anything.
 */
function MoodCheck({
  onSelect,
  question = 'Wie fühlst du dich gerade?'
}) {
  const [picked, setPicked] = React.useState(null);
  const OPTIONS = [['gut', 'Gut', 'var(--good)', 'var(--good-soft)'], ['angespannt', 'Angespannt', 'var(--warn)', 'var(--warn-soft)'], ['gestresst', 'Gestresst', 'var(--bad)', 'var(--bad-soft)']];
  const pick = id => {
    setPicked(id);
    if (onSelect) onSelect(id);
  };
  if (picked) {
    const opt = OPTIONS.find(([id]) => id === picked);
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 12px',
        borderRadius: 'var(--radius-pill)',
        background: opt[3],
        color: opt[2],
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 13
    }), "Notiert \u2014 flie\xDFt in deinen Balance-Trend ein.");
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, question), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 5
    }
  }, OPTIONS.map(([id, label, color, soft]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => pick(id),
    style: {
      border: '1.5px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 12px',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      background: 'var(--surface)',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      transition: 'all var(--dur-fast) var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = color;
      e.currentTarget.style.background = soft;
      e.currentTarget.style.color = color;
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--border)';
      e.currentTarget.style.background = 'var(--surface)';
      e.currentTarget.style.color = 'var(--ink-2)';
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color
    }
  }), label))));
}
Object.assign(__ds_scope, { MoodCheck });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/MoodCheck.jsx", error: String((e && e.message) || e) }); }

// components/instruments/OvertimeGauge.jsx
try { (() => {
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Overtime balance gauge — positive/negative around zero.
 *  Animates: bar grows out from the zero line on mount, hours count up. */
function OvertimeGauge({
  hours = 4.5,
  max = 20
}) {
  const [shown, setShown] = React.useState(reduced() ? hours : 0);
  React.useEffect(() => {
    if (reduced()) {
      setShown(hours);
      return;
    }
    let raf, start;
    const dur = 800;
    const step = t => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setShown(hours * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hours]);
  const pct = Math.max(-1, Math.min(1, shown / max));
  const isPositive = hours >= 0;
  const width = Math.abs(pct) * 50;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      width: 220
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 10,
      background: 'var(--surface-sunk)',
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '50%',
      top: 0,
      bottom: 0,
      width: 1,
      background: 'var(--border-strong)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: isPositive ? '50%' : `${50 - width}%`,
      width: `${width}%`,
      background: isPositive ? 'var(--good)' : 'var(--crit)',
      borderRadius: 'var(--radius-pill)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: isPositive ? 'var(--good)' : 'var(--crit)'
    }
  }, isPositive ? '+' : '', shown.toFixed(1), "h"));
}
Object.assign(__ds_scope, { OvertimeGauge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/OvertimeGauge.jsx", error: String((e && e.message) || e) }); }

// components/instruments/StatTile.jsx
try { (() => {
function StatTile({
  label,
  value,
  delta,
  mono = true
}) {
  const isUp = typeof delta === 'number' && delta > 0;
  const isDown = typeof delta === 'number' && delta < 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      fontWeight: 600
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
      fontSize: 'var(--fs-xl)',
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, value), delta !== undefined && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: isUp ? 'var(--good)' : isDown ? 'var(--crit)' : 'var(--ink-2)'
    }
  }, isUp ? '+' : '', delta, typeof delta === 'number' ? '%' : ''));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/instruments/WeekSparkline.jsx
try { (() => {
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Small-multiple week sparkline — daily hours, no axes/labels, instrument-like.
 *  Animates: bars grow up from the baseline with a small left-to-right stagger. */
function WeekSparkline({
  values = [6, 7.5, 8, 5, 7, 2, 0],
  color = 'var(--accent)',
  width = 180,
  height = 40
}) {
  const max = Math.max(...values, 1);
  const barW = width / values.length - 4;
  const [mounted, setMounted] = React.useState(reduced());
  React.useEffect(() => {
    if (reduced()) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`
  }, values.map((v, i) => {
    const h = v / max * (height - 4);
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: i * (barW + 4),
      y: height - h,
      width: barW,
      height: h,
      rx: 2,
      fill: color,
      opacity: v === 0 ? 0.15 : 1,
      style: {
        transform: mounted ? 'scaleY(1)' : 'scaleY(0)',
        transformOrigin: `${i * (barW + 4) + barW / 2}px ${height}px`,
        transition: `transform var(--dur-slow) var(--ease-spring) ${i * 45}ms`
      }
    });
  }));
}
Object.assign(__ds_scope, { WeekSparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/instruments/WeekSparkline.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppShell.jsx
try { (() => {
/**
 * The app shell (ux-vision §3 IA). `posture="sidebar"` renders the floating
 * light nav rail (follows data-mode; Blueprint overrides to its fixed dark
 * ink shell via --rail-* tokens). `posture="tabs"` renders the five phone
 * tabs with a pill active state. Matches @mydevtime/design's chromeForWidth /
 * PHONE_TABS / SIDEBAR_ITEMS 1:1.
 */
function AppShell({
  posture = 'sidebar',
  items,
  active,
  onNavigate,
  island,
  children
}) {
  const list = items || (posture === 'sidebar' ? ['today', 'planner', 'absence', 'projects', 'reports', 'meetings', 'assistant', 'profile'] : ['today', 'planner', 'projects', 'reports', 'profile']);
  const labels = {
    today: 'Today',
    planner: 'Planner',
    absence: 'Absence',
    projects: 'Projects',
    reports: 'Reports',
    meetings: 'Meetings',
    assistant: 'Assistant',
    profile: 'Profile'
  };
  if (posture === 'tabs') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflow: 'auto'
      }
    }, children), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: 'var(--app-tabbar-h)',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-raised)',
        padding: '6px 8px',
        boxSizing: 'border-box',
        gap: 4
      }
    }, list.map(id => /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => onNavigate && onNavigate(id),
      style: {
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
        transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: id
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 600
      }
    }, labels[id])))));
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
    color: active === id ? 'var(--rail-ink-active, var(--accent-strong))' : 'var(--rail-ink, var(--ink-2))',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 'var(--app-sidebar-width)',
      flexShrink: 0,
      padding: 12,
      boxSizing: 'border-box',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      padding: '16px 10px',
      background: 'var(--rail-bg, var(--surface))',
      border: '1px solid var(--rail-border, var(--border))',
      borderRadius: 20,
      boxShadow: 'var(--shadow-md)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 10px 18px',
      color: 'var(--rail-brand-ink, var(--ink))'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "26",
    height: "26",
    viewBox: "0 0 256 256",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: "256",
    height: "256",
    rx: "60",
    fill: "#3654E0"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "46",
    y: "94",
    width: "64",
    height: "76",
    rx: "18",
    fill: "#ffffff"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "146",
    y: "94",
    width: "64",
    height: "76",
    rx: "18",
    fill: "#ffffff",
    opacity: "0.38"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "121",
    y: "72",
    width: "14",
    height: "112",
    rx: "7",
    fill: "#FF5320"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "128",
    cy: "54",
    r: "16",
    fill: "#FF5320"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15
    }
  }, "myDevTime")), list.map(id => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => onNavigate && onNavigate(id),
    style: itemStyle(id),
    onMouseEnter: e => {
      if (active !== id) e.currentTarget.style.background = 'var(--rail-item-hover, color-mix(in srgb, var(--ink) 6%, transparent))';
    },
    onMouseLeave: e => {
      if (active !== id) e.currentTarget.style.background = 'transparent';
    }
  }, id === 'assistant' ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 7,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "assistant",
    size: 14
  })) : /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: id
  }), labels[id], active === id && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'var(--live)',
      flexShrink: 0
    }
  }))), island && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 'auto',
      paddingTop: 12
    }
  }, island))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'hidden',
      minWidth: 0
    }
  }, children));
}
Object.assign(__ds_scope, { AppShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppShell.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items,
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border)'
    }
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.value,
    onClick: () => onChange && onChange(it.value),
    style: {
      padding: '10px 4px',
      marginRight: 20,
      border: 'none',
      borderBottom: `2px solid ${active === it.value ? 'var(--accent)' : 'transparent'}`,
      background: 'none',
      color: active === it.value ? 'var(--ink)' : 'var(--ink-2)',
      fontWeight: 600,
      fontSize: 'var(--fs-sm)',
      cursor: 'pointer'
    }
  }, it.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/AbsenceScreen.jsx
try { (() => {
/* Absence module — punch-clock users' second half of the app: Urlaub,
   Krank, Gleittage, Feiertage (Baden-Württemberg). Bounded layout:
   header fixed, content scrolls internally. AI only PROPOSES (Brückentag
   via AICallout) — never books anything. */
function AbsenceScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Card,
    Badge,
    Button,
    AICallout,
    Icon
  } = DS;
  /* Guard against bundle lag: if the freshly-added LeaveBalance hasn't been
     recompiled into _ds_bundle.js yet, render an inline fallback instead of
     crashing the whole app mount (same pattern as TodayScreen's MoodCheck). */
  const LeaveBalance = DS.LeaveBalance || (({
    entitlement = 30,
    taken = 0,
    planned = 0,
    carryover = 0
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 34,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)'
    }
  }, Math.max(0, entitlement + carryover - taken - planned)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, "Tage Urlaub \xFCbrig")));
  const YEAR = 2026;
  const [showForm, setShowForm] = React.useState(false);
  const [reqType, setReqType] = React.useState('Urlaub');
  const [from, setFrom] = React.useState('2026-08-24');
  const [to, setTo] = React.useState('2026-08-25');
  const [requests, setRequests] = React.useState([{
    type: 'Urlaub',
    range: '10.–14. Aug',
    days: 5,
    status: 'Genehmigt'
  }]);

  // BW public holidays 2026 (month 1-based)
  const HOLIDAYS = [[1, 1, 'Neujahr'], [1, 6, 'Hl. Drei Könige'], [4, 3, 'Karfreitag'], [4, 6, 'Ostermontag'], [5, 1, 'Tag der Arbeit'], [5, 14, 'Christi Himmelfahrt'], [5, 25, 'Pfingstmontag'], [6, 4, 'Fronleichnam'], [10, 3, 'Tag der Dt. Einheit'], [11, 1, 'Allerheiligen'], [12, 25, '1. Weihnachtstag'], [12, 26, '2. Weihnachtstag']];
  const VACATION = [[2, 9], [2, 10], [2, 11], [2, 12], [2, 13], [5, 15], [5, 26], [5, 27], [5, 28], [5, 29], [7, 6], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14]];
  const SICK = [[3, 17], [3, 18], [3, 19]];
  const typeOf = (m, d) => {
    if (HOLIDAYS.some(([hm, hd]) => hm === m && hd === d)) return 'holiday';
    if (SICK.some(([sm, sd]) => sm === m && sd === d)) return 'sick';
    if (VACATION.some(([vm, vd]) => vm === m && vd === d)) return 'vacation';
    const wd = new Date(YEAR, m - 1, d).getDay();
    if (wd === 0 || wd === 6) return 'weekend';
    return null;
  };
  const cellBg = {
    holiday: 'var(--ink-3)',
    sick: 'var(--bad)',
    vacation: 'var(--accent)',
    weekend: 'var(--surface-sunk)',
    null: 'transparent'
  };
  const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const daysIn = m => new Date(YEAR, m, 0).getDate();
  const TODAY = [7, 12]; // 12. Juli

  const fmtD = iso => {
    const [, m, d] = iso.split('-');
    return parseInt(d) + '.' + parseInt(m) + '.';
  };
  const submit = () => {
    const d1 = new Date(from),
      d2 = new Date(to);
    let n = 0;
    for (let t = new Date(d1); t <= d2; t.setDate(t.getDate() + 1)) {
      const wd = t.getDay();
      if (wd !== 0 && wd !== 6) n++;
    }
    setRequests(rs => [...rs, {
      type: reqType,
      range: fmtD(from) + '–' + fmtD(to),
      days: Math.max(1, n),
      status: 'Angefragt'
    }]);
    setShowForm(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
      flexWrap: 'wrap',
      rowGap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      flex: 1,
      minWidth: 160
    }
  }, "Absence"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 6px',
      background: 'var(--surface)',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 8px'
    }
  }, "\u2039"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, YEAR), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 8px'
    }
  }, "\u203A")), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setShowForm(!showForm)
  }, showForm ? 'Abbrechen' : 'Antrag stellen'))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      margin: '0 -28px',
      padding: '4px 28px 28px'
    }
  }, showForm && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'flex-end',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Art"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, ['Urlaub', 'Gleittag', 'Sonderurlaub'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setReqType(t),
    style: {
      padding: '8px 14px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      border: reqType === t ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
      background: reqType === t ? 'var(--accent-soft)' : 'var(--surface)',
      color: reqType === t ? 'var(--accent-strong)' : 'var(--ink-2)'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Von"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: from,
    onChange: e => setFrom(e.target.value),
    style: {
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-xs)',
      fontFamily: 'var(--font-mono)',
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Bis"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: to,
    onChange: e => setTo(e.target.value),
    style: {
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-xs)',
      fontFamily: 'var(--font-mono)',
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement(Button, {
    onClick: submit
  }, "Anfragen"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginBottom: 16,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Urlaubskonto",
    style: {
      flex: '2 1 340px'
    }
  }, /*#__PURE__*/React.createElement(LeaveBalance, {
    entitlement: 30,
    taken: 11,
    planned: 5,
    carryover: 2
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Krank",
    subtitle: "dieses Jahr",
    style: {
      flex: '1 1 150px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 34,
      fontWeight: 600,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)'
    }
  }, "3"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, "Tage")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 10
    }
  }, "zuletzt 17.\u201319. M\xE4rz")), /*#__PURE__*/React.createElement(Card, {
    title: "Gleitzeit-Konto",
    subtitle: "AZK",
    style: {
      flex: '1 1 150px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 34,
      fontWeight: 600,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--good)'
    }
  }, "+12:40")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 10
    }
  }, "\u2248 1,5 Gleittage m\xF6glich"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Jahres\xFCbersicht",
    subtitle: "Urlaub \xB7 Krank \xB7 Feiertage (Baden-W\xFCrttemberg)",
    style: {
      flex: '2 1 520px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, MONTHS.map((name, mi) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      flexShrink: 0
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 2,
      flex: 1
    }
  }, Array.from({
    length: 31
  }, (_, i) => i + 1).map(d => {
    if (d > daysIn(mi + 1)) return /*#__PURE__*/React.createElement("span", {
      key: d,
      style: {
        flex: 1
      }
    });
    const t = typeOf(mi + 1, d);
    const isToday = mi + 1 === TODAY[0] && d === TODAY[1];
    return /*#__PURE__*/React.createElement("span", {
      key: d,
      title: name + ' ' + d + '.',
      style: {
        flex: 1,
        aspectRatio: '1 / 1.5',
        maxWidth: 16,
        borderRadius: 3,
        background: cellBg[t] || 'transparent',
        border: isToday ? '1.5px solid var(--live)' : t ? 'none' : '1px solid var(--border)',
        boxSizing: 'border-box'
      }
    });
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      marginTop: 14,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: 'var(--accent)'
    }
  }), "Urlaub"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: 'var(--bad)'
    }
  }), "Krank"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: 'var(--ink-3)'
    }
  }), "Feiertag"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: 'var(--surface-sunk)',
      border: '1px solid var(--border)',
      boxSizing: 'border-box'
    }
  }), "Wochenende"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      border: '1.5px solid var(--live)',
      boxSizing: 'border-box'
    }
  }), "Heute"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 300px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(AICallout, {
    compact: true,
    title: "Br\xFCckentag-Chance",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setRequests(rs => rs.some(r => r.range === '15. Mai') ? rs : [...rs, {
        type: 'Urlaub',
        range: '15. Mai',
        days: 1,
        status: 'Angefragt'
      }])
    }, "\u2726 Anfragen")
  }, "Christi Himmelfahrt ist Do 14.5. \u2014 mit Fr 15.5. werden aus 1 Urlaubstag 4 freie Tage."), /*#__PURE__*/React.createElement(Card, {
    title: "Antr\xE4ge"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, requests.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, r.type, " \xB7 ", r.range), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 2,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, r.days, " ", r.days === 1 ? 'Tag' : 'Tage')), /*#__PURE__*/React.createElement(Badge, {
    tone: r.status === 'Genehmigt' ? 'good' : 'neutral'
  }, r.status))))), /*#__PURE__*/React.createElement(Card, {
    title: "N\xE4chste Feiertage",
    subtitle: "Baden-W\xFCrttemberg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, [['Sa 3.10.', 'Tag der Dt. Einheit'], ['So 1.11.', 'Allerheiligen'], ['Fr 25.12.', '1. Weihnachtstag'], ['Sa 26.12.', '2. Weihnachtstag']].map(([d, n]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      fontVariantNumeric: 'tabular-nums',
      width: 62,
      flexShrink: 0
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink)'
    }
  }, n)))))))));
}
window.AbsenceScreen = AbsenceScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/AbsenceScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/AssistantScreen.jsx
try { (() => {
function AssistantScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Card,
    Badge,
    Button
  } = DS;
  // Defensive: never blank-screen on a one-compile-stale bundle
  const Icon = DS.Icon || (() => null);
  const EmptyState = DS.EmptyState || (({
    title,
    hint
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      border: '1.5px dashed var(--border-strong)',
      borderRadius: 'var(--radius-xl)',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      marginTop: 6
    }
  }, hint)));
  const [msgs, setMsgs] = React.useState([]);
  const [input, setInput] = React.useState('');

  // Grounded, read-only (ux-vision §3, ADR-0005): answers only from the
  // workspace's own data via deterministic query tools; 1 credit per question.
  const SCRIPTED = {
    'Wo bin ich über Budget?': 'Finanzo liegt bei 92% des 40h-Monatsbudgets (36,8h gebucht) — das einzige Projekt über 80%. Huber CMS steht bei 54%, alles andere unter der Hälfte.',
    'Entwirf mein Standup': 'Gestern: 6,4h auf Finanzo-Auth (2,5h), Konflikt-Tests (1,5h) und Reviews. Heute: Sprint-Review um 14:00 und die Tombstone-Story. Keine Blocker gemeldet.'
  };
  const send = text => {
    if (!text.trim()) return;
    const answer = SCRIPTED[text] || 'In dieser Preview beantworte ich die Beispielfragen. Im Produkt beantwortet der Assistant jede Frage zu deinen Zeiten, Projekten, Budgets und Meetings über deterministische Query-Tools — 1 Credit pro Frage.';
    setMsgs(m => [...m, {
      role: 'user',
      text
    }, {
      role: 'assistant',
      text: answer
    }]);
    setInput('');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 28,
      maxWidth: 760,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "assistant",
    size: 20
  })), "Assistant"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, "deine Daten \xB7 nur Lesezugriff")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingBottom: 16
    }
  }, msgs.length === 0 && /*#__PURE__*/React.createElement(EmptyState, {
    icon: "assistant",
    title: "Frag deine eigenen Daten",
    hint: "Der Assistant antwortet nur aus deinen Zeiten, Projekten, Budgets und Meetings \u2014 jede Zahl kommt aus der deterministischen Aggregation, nie aus dem Modell. 1 Credit pro Frage."
  }), msgs.map((m, i) => m.role === 'user' ? /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: 'flex-end',
      maxWidth: '85%',
      padding: '10px 14px',
      borderRadius: 'var(--radius-card)',
      background: 'var(--accent)',
      color: 'var(--accent-contrast)',
      fontSize: 'var(--fs-sm)',
      lineHeight: 'var(--lh-normal)'
    }
  }, m.text) : /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: 'flex-start',
      maxWidth: '85%',
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      padding: '10px 14px',
      fontSize: 'var(--fs-sm)',
      lineHeight: 'var(--lh-normal)',
      color: 'var(--ink)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", null, m.text), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Zahlen aus der deterministischen Aggregation \xB7 nie aus dem Modell"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, Object.keys(SCRIPTED).map(s => /*#__PURE__*/React.createElement(Button, {
    key: s,
    size: "sm",
    variant: "ghost",
    onClick: () => send(s)
  }, s))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') send(input);
    },
    placeholder: "Frag nach Zeiten, Budgets, Meetings \u2026 \xB7 1 Credit",
    style: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 'var(--radius-block)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: () => send(input)
  }, "Senden"))));
}
window.AssistantScreen = AssistantScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/AssistantScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/MeetingsScreen.jsx
try { (() => {
function MeetingsScreen() {
  const {
    Card,
    Badge,
    Button
  } = window.MyDevTimeDesignSystem_254296;
  const MEETINGS = [{
    id: 'm1',
    title: 'Finanzo sprint review',
    color: 'var(--project-1)',
    time: '09:30',
    duration: '46m',
    state: 'insights',
    summary: ['Sync conflict policy signed off — last-writer-wins with tombstones (REQ-006).', 'Invoice export slips to next sprint; budget rings stay in scope.', 'Two calendar edge cases reassigned to the automation module.'],
    actions: ['Draft ADR amendment for the tombstone retention window', 'Split the invoice-export story from the timesheet epic']
  }, {
    id: 'm2',
    title: 'Huber CMS kickoff',
    color: 'var(--project-6)',
    time: '13:00',
    duration: '31m',
    state: 'transcript'
  }, {
    id: 'm3',
    title: 'Nordwind planning',
    color: 'var(--project-3)',
    time: '15:00',
    duration: '—',
    state: 'upcoming'
  }];
  const [selId, setSelId] = React.useState('m1');
  const [note, setNote] = React.useState(null);
  const sel = MEETINGS.find(m => m.id === selId) || MEETINGS[0];
  const stateBadge = s => s === 'insights' ? {
    tone: 'good',
    label: 'Insights ✓'
  } : s === 'transcript' ? {
    tone: 'neutral',
    label: 'Transcript'
  } : {
    tone: 'warn',
    label: 'Recording opted in'
  };
  const SectionTitle = ({
    children,
    credit
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, children), credit && /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "AI \xB7 1 credit"));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Meetings"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--ink-2)',
      fontSize: 'var(--fs-sm)'
    }
  }, "Transkripte & AI-Insights \xB7 nur mit Zustimmung")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'stretch',
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 300,
      flexShrink: 0,
      overflowY: 'auto',
      paddingBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "This week"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, MEETINGS.map(m => {
    const active = m.id === selId;
    const b = stateBadge(m.state);
    return /*#__PURE__*/React.createElement("button", {
      key: m.id,
      onClick: () => {
        setSelId(m.id);
        setNote(null);
      },
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        alignItems: 'stretch',
        textAlign: 'left',
        padding: '10px 12px',
        borderRadius: 'var(--radius-block)',
        cursor: 'pointer',
        background: active ? 'var(--bg)' : 'transparent',
        border: '1px solid ' + (active ? 'var(--border)' : 'transparent'),
        transition: 'background var(--dur-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: m.color,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        color: 'var(--ink)'
      }
    }, m.title)), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, m.time, " \xB7 ", m.duration), /*#__PURE__*/React.createElement(Badge, {
      tone: b.tone
    }, b.label)));
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflowY: 'auto',
      minWidth: 0,
      paddingBottom: 28
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: sel.title,
    subtitle: sel.time + ' · ' + sel.duration,
    action: sel.state !== 'upcoming' && /*#__PURE__*/React.createElement(Badge, {
      tone: "good"
    }, "Transcript \xB7 de")
  }, sel.state === 'insights' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, {
    credit: true
  }, "Summary"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, sel.summary.map(s => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: 'flex',
      gap: 8,
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, s))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Action items"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, sel.actions.map(a => /*#__PURE__*/React.createElement("div", {
    key: a,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 'var(--radius-block)',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: '1 1 220px',
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, a), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, ['Task', 'Jira', 'GitHub', 'Slack'].map(target => /*#__PURE__*/React.createElement(Button, {
    key: target,
    size: "sm",
    variant: "ghost",
    onClick: () => setNote('Creates a ' + target + ' item from a preview payload — after you confirm, never automatically.')
  }, "\u2192 ", target))))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Custom prompts"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, ['Draft follow-up email', 'Extract scope changes', 'List decisions'].map(p => /*#__PURE__*/React.createElement("button", {
    key: p,
    onClick: () => setNote('Prompt „' + p + '" would cost 1 AI credit.'),
    style: {
      padding: '6px 12px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid var(--border)',
      background: 'var(--bg)',
      color: 'var(--ink-2)',
      fontSize: 'var(--fs-xs)',
      cursor: 'pointer'
    }
  }, "\u2726 ", p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-3)',
      lineHeight: 'var(--lh-normal)'
    }
  }, "Every figure comes from the deterministic core \u2014 never the model. The transcript is your data: export and deletion included.")), sel.state === 'transcript' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, "Transcript ready \u2014 no insights generated yet."), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => setNote('Summarizing would cost 1 AI credit (demo).')
  }, "\u2726 Summarize \xB7 1 credit")), sel.state === 'upcoming' && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)',
      lineHeight: 'var(--lh-normal)'
    }
  }, "Starts at 15:00. Recording consent is granted (revocable per meeting) \u2014 the bot joins visibly and every participant sees the recording status.")), note && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, note)))));
}
window.MeetingsScreen = MeetingsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/MeetingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/OnboardingFlow.jsx
try { (() => {
/* First-run onboarding — the moment users decide to stay.
   Flow: Welcome (logo sting) → Arbeitszeit → Projekte → Auto-Tracker → Fertig.
   Principles: bounded (no scroll), one decision per step, every step skippable,
   privacy stated where data is touched (ux-vision §5: trust is the aesthetic). */
function OnboardingFlow() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Button,
    Icon
  } = DS;
  const [step, setStep] = React.useState(0);

  // Step 1 — Arbeitszeit (minutes/day)
  const [daily, setDaily] = React.useState(504); // 8:24 = 42h-Woche
  const [autoBreak, setAutoBreak] = React.useState(true);
  const fmtHM = m => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');

  // Step 2 — Projekte
  const COLORS = ['var(--project-1)', 'var(--project-2)', 'var(--project-3)', 'var(--project-4)', 'var(--project-5)'];
  const [projects, setProjects] = React.useState([]);
  const [pName, setPName] = React.useState('');
  const [pColor, setPColor] = React.useState(0);
  const [imported, setImported] = React.useState(null);
  const addProject = () => {
    if (!pName.trim()) return;
    setProjects(ps => [...ps, {
      name: pName.trim(),
      color: COLORS[pColor]
    }]);
    setPName('');
    setPColor(c => (c + 1) % COLORS.length);
  };

  // Step 3 — Auto-Tracker
  const [tracker, setTracker] = React.useState(null); // true | false | null

  const steps = ['Willkommen', 'Arbeitszeit', 'Projekte', 'Auto-Tracker', 'Fertig'];
  const last = steps.length - 1;
  const shellStyle = {
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: step === 0 ? 'radial-gradient(120% 120% at 50% 0%, #16255c 0%, #0d1330 55%, #0a0c11 100%)' : 'var(--bg)',
    fontFamily: 'var(--font-ui)',
    color: 'var(--ink)',
    transition: 'background 400ms var(--ease-out)'
  };
  const Dots = () => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      padding: '18px 0'
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("span", {
    key: s,
    title: s,
    style: {
      width: i === step ? 22 : 7,
      height: 7,
      borderRadius: 999,
      background: i === step ? 'var(--live)' : step === 0 ? 'rgba(255,255,255,0.25)' : 'var(--border-strong)',
      transition: 'width var(--dur-med) var(--ease-spring), background var(--dur-med) var(--ease-out)'
    }
  })));
  const NavRow = ({
    nextLabel = 'Weiter',
    nextDisabled = false,
    onNext,
    skip = true
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(s => Math.max(0, s - 1)),
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      padding: '10px 6px'
    }
  }, "Zur\xFCck"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), skip && /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(s => Math.min(last, s + 1)),
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      padding: '10px 6px'
    }
  }, "\xDCberspringen"), /*#__PURE__*/React.createElement(Button, {
    onClick: onNext || (() => setStep(s => Math.min(last, s + 1))),
    disabled: nextDisabled
  }, nextLabel));
  const card = {
    width: 'min(560px, calc(100vw - 48px))',
    margin: '0 auto',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    padding: '32px 34px',
    boxSizing: 'border-box',
    animation: 'ob-rise 380ms var(--ease-spring) both'
  };
  const h1 = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 'var(--fs-xl)',
    letterSpacing: 'var(--ls-tight)',
    margin: 0
  };
  const sub = {
    fontSize: 'var(--fs-sm)',
    color: 'var(--ink-2)',
    lineHeight: 'var(--lh-normal)',
    margin: '6px 0 24px'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: shellStyle
  }, /*#__PURE__*/React.createElement("style", null, `
        @keyframes ob-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ob-tile { 0% { transform: scale(0.55); opacity: 0; } 55% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ob-sweep { 0%, 25% { transform: scaleY(0); } 60%, 100% { transform: scaleY(1); } }
        @keyframes ob-pulse { 0%, 45% { transform: scale(0); } 62% { transform: scale(1.35); } 75%, 100% { transform: scale(1); } }
        @keyframes ob-slide { 0%, 35% { transform: translateX(-16px); opacity: 0; } 65%, 100% { transform: translateX(0); opacity: 1; } }
        @keyframes ob-fade { 0%, 55% { opacity: 0; } 85%, 100% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `), step > 0 && /*#__PURE__*/React.createElement(Dots, null), step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 118,
      height: 118,
      borderRadius: 28,
      background: 'linear-gradient(135deg, #3D5CF5 0%, #2941B8 100%)',
      boxShadow: '0 24px 60px -18px rgba(61,92,245,0.55)',
      animation: 'ob-tile 700ms var(--ease-spring) both'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 23,
      top: 44,
      width: 28,
      height: 33,
      borderRadius: 8,
      background: '#fff',
      animation: 'ob-slide 1300ms var(--ease-spring) both'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 67,
      top: 44,
      width: 28,
      height: 33,
      borderRadius: 8,
      border: '3px dashed rgba(255,255,255,0.8)',
      boxSizing: 'border-box',
      animation: 'ob-fade 1600ms ease both'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 56.5,
      top: 37,
      width: 5,
      height: 48,
      borderRadius: 3,
      background: 'var(--live)',
      transformOrigin: 'top center',
      animation: 'ob-sweep 1100ms var(--ease-out) both'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 53,
      top: 23,
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: 'var(--live)',
      animation: 'ob-pulse 1500ms ease both'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      animation: 'ob-rise 500ms 600ms var(--ease-out) both'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 34,
      letterSpacing: '-0.02em',
      color: '#fff'
    }
  }, "my", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--live)'
    }
  }, "Dev"), "Time"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'rgba(255,255,255,0.55)',
      marginTop: 8
    }
  }, "Dein Tag, geplant. Plan und Realit\xE4t auf einer Fl\xE4che.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 14,
      animation: 'ob-rise 500ms 900ms var(--ease-out) both'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: () => setStep(1)
  }, "Los geht's"), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'rgba(255,255,255,0.45)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600
    }
  }, "Ich habe schon ein Konto"))), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: card
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1
  }, "Deine t\xE4gliche Sollzeit"), /*#__PURE__*/React.createElement("p", {
    style: sub
  }, "Daraus rechnet myDevTime \xDCberstunden, Drift und deine Balance. Sp\xE4ter jederzeit im Profil \xE4nderbar \u2014 auch pro Wochentag."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 22,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDaily(d => Math.max(240, d - 5)),
    "aria-label": "5 Minuten weniger",
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      cursor: 'pointer',
      fontSize: 20,
      color: 'var(--ink-2)'
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      minWidth: 150
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 46,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--ink)',
      lineHeight: 1
    }
  }, fmtHM(daily)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 6
    }
  }, "Stunden pro Tag")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDaily(d => Math.min(720, d + 5)),
    "aria-label": "5 Minuten mehr",
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      cursor: 'pointer',
      fontSize: 20,
      color: 'var(--ink-2)'
    }
  }, "+")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      marginBottom: 20
    }
  }, [456, 480, 504].map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setDaily(m),
    style: {
      padding: '7px 14px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      border: daily === m ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: daily === m ? 'var(--accent-soft)' : 'var(--surface)',
      color: daily === m ? 'var(--accent-strong)' : 'var(--ink-2)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtHM(m)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, "Woche (\xD75)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtHM(daily * 5), " h")), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: autoBreak,
    onChange: e => setAutoBreak(e.target.checked),
    style: {
      width: 16,
      height: 16,
      accentColor: 'var(--accent)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, "Gesetzliche Pausen automatisch abziehen (30 min ab 6 h)")), /*#__PURE__*/React.createElement(NavRow, {
    skip: false
  }))), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: card
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1
  }, "Woran arbeitest du?"), /*#__PURE__*/React.createElement("p", {
    style: sub
  }, "Leg dein erstes Projekt an \u2014 oder bring deine Historie mit. Farben kommen aus der festen Projekt-Palette."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: pName,
    onChange: e => setPName(e.target.value),
    onKeyDown: e => e.key === 'Enter' && addProject(),
    placeholder: "Projektname, z. B. Finanzo AG",
    style: {
      flex: 1,
      minWidth: 0,
      padding: '11px 14px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-sm)',
      outline: 'none',
      fontFamily: 'var(--font-ui)'
    }
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: addProject,
    disabled: !pName.trim()
  }, "Anlegen")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 18
    }
  }, COLORS.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setPColor(i),
    "aria-label": 'Farbe ' + (i + 1),
    style: {
      width: 26,
      height: 26,
      borderRadius: '50%',
      background: c,
      border: pColor === i ? '2.5px solid var(--ink)' : '2.5px solid transparent',
      cursor: 'pointer',
      boxSizing: 'border-box'
    }
  }))), projects.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginBottom: 18,
      maxHeight: 130,
      overflow: 'auto'
    }
  }, projects.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 8,
      background: 'color-mix(in srgb, ' + p.color + ' 16%, var(--surface))',
      color: p.color,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12
    }
  }, p.name.slice(0, 2).toUpperCase()), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      fontWeight: 600
    }
  }, p.name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border)',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      letterSpacing: 'var(--ls-wide)',
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      marginBottom: 10
    }
  }, "Oder importieren"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, ['Toggl', 'Clockify', 'CSV'].map(src => /*#__PURE__*/React.createElement("button", {
    key: src,
    onClick: () => {
      setImported(src);
      setProjects(ps => ps.length ? ps : [{
        name: 'Finanzo AG',
        color: COLORS[0]
      }, {
        name: 'Sync engine',
        color: COLORS[1]
      }, {
        name: 'Nordwind GmbH',
        color: COLORS[2]
      }]);
    },
    style: {
      padding: '8px 16px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      border: imported === src ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
      background: imported === src ? 'var(--accent-soft)' : 'var(--surface)',
      color: imported === src ? 'var(--accent-strong)' : 'var(--ink-2)'
    }
  }, imported === src ? '✓ ' + src : src))), imported && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--good)',
      marginTop: 10
    }
  }, "3 Projekte aus ", imported, " importiert \u2014 Zeiten folgen im Hintergrund.")), /*#__PURE__*/React.createElement(NavRow, {
    nextDisabled: false
  }))), step === 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: card
  }, /*#__PURE__*/React.createElement("h1", {
    style: h1
  }, "Auto-Tracker aktivieren?"), /*#__PURE__*/React.createElement("p", {
    style: sub
  }, "W\xE4hrend ein Timer l\xE4uft, kann myDevTime lokal aufzeichnen, welche Apps du wie lange nutzt \u2014 dein Tag f\xFCllt sich von selbst."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 18px',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--live-border)',
      background: 'var(--live-soft)',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: 'var(--live)',
      flexShrink: 0,
      boxShadow: '0 0 0 5px color-mix(in srgb, var(--live) 18%, transparent)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-sm)',
      fontWeight: 700
    }
  }, "VS Code \xB7 1h 36m"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, "So sieht ein aufgezeichneter Eintrag aus.")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--live)',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "REC")), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: '0 0 8px',
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, ['Bleibt zu 100 % auf diesem Gerät — nichts geht in die Cloud', 'Einzelne Apps jederzeit ausschließbar', 'Läuft nur, während du trackst — nie im Hintergrund'].map(t => /*#__PURE__*/React.createElement("li", {
    key: t,
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'baseline',
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--good)',
      fontWeight: 700
    }
  }, "\u2713"), t))), /*#__PURE__*/React.createElement(NavRow, {
    nextLabel: tracker === false ? 'Weiter' : 'Aktivieren & weiter',
    onNext: () => {
      if (tracker === null) setTracker(true);
      setStep(4);
    },
    skip: false
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setTracker(false);
      setStep(4);
    },
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      marginTop: 6,
      padding: 6
    }
  }, "Jetzt nicht \u2014 sp\xE4ter im Profil"))), step === 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--good-soft, var(--accent-soft))',
      color: 'var(--good)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 26,
      marginBottom: 14
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("h1", {
    style: h1
  }, "Alles bereit."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...sub,
      marginBottom: 20
    }
  }, "Dein erster Tag ist noch leer \u2014 genau richtig. Starte den Timer, wenn du loslegst, oder lass den Co-Planner einen Vorschlag machen."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      textAlign: 'left',
      marginBottom: 24
    }
  }, [['Sollzeit', fmtHM(daily) + ' h/Tag · ' + fmtHM(daily * 5) + ' h/Woche'], ['Projekte', projects.length > 0 ? projects.length + ' angelegt' : 'noch keine — geht auch später'], ['Auto-Tracker', tracker ? 'aktiv (lokal)' : 'aus']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    onClick: () => {
      window.location.href = 'index.html';
    }
  }, "Zum Workspace")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setStep(0),
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      marginTop: 14,
      padding: 6
    }
  }, "Demo neu starten"))));
}
window.OnboardingFlow = OnboardingFlow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/OnboardingFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/PlannerScreen.jsx
try { (() => {
function PlannerScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Card,
    Button,
    Tabs
  } = DS;
  const AIAskBar = DS.AIAskBar || (() => null);
  const [view, setView] = React.useState('week'); // week | month | year
  const HOUR_H = 44;
  const START = 8,
    END = 18;
  const hours = [];
  for (let h = START; h <= END; h++) hours.push(h);
  const colH = (END - START) * HOUR_H;
  const days = [{
    name: 'Mon',
    date: '7.7.',
    total: '7,2h'
  }, {
    name: 'Tue',
    date: '8.7.',
    total: '5,4h',
    today: true
  }, {
    name: 'Wed',
    date: '9.7.',
    total: '6,5h'
  }, {
    name: 'Thu',
    date: '10.7.',
    total: '7,0h'
  }, {
    name: 'Fri',
    date: '11.7.',
    total: '—'
  }];

  // day: 0–4 · s/d in decimal hours · kind: actual | meeting | ghost
  const [blocks, setBlocks] = React.useState([{
    id: 1,
    day: 0,
    s: 9,
    d: 0.25,
    l: 'Standup',
    c: 'var(--project-1)',
    k: 'meeting',
    rec: true
  }, {
    id: 2,
    day: 0,
    s: 9.5,
    d: 2.5,
    l: 'Finanzo API',
    c: 'var(--project-1)',
    k: 'actual'
  }, {
    id: 3,
    day: 0,
    s: 13,
    d: 2,
    l: 'Sync engine',
    c: 'var(--project-2)',
    k: 'actual'
  }, {
    id: 4,
    day: 0,
    s: 15.5,
    d: 1.5,
    l: 'Code review',
    c: 'var(--project-4)',
    k: 'actual'
  }, {
    id: 5,
    day: 1,
    s: 9,
    d: 0.25,
    l: 'Standup',
    c: 'var(--project-1)',
    k: 'meeting',
    rec: true
  }, {
    id: 18,
    day: 0,
    s: 12.5,
    d: 0.5,
    l: 'Pause',
    c: 'var(--ink-3)',
    k: 'break'
  }, {
    id: 19,
    day: 1,
    s: 12,
    d: 0.75,
    l: 'Pause',
    c: 'var(--ink-3)',
    k: 'break'
  }, {
    id: 20,
    day: 2,
    s: 12.5,
    d: 0.5,
    l: 'Pause',
    c: 'var(--ink-3)',
    k: 'break'
  }, {
    id: 21,
    day: 3,
    s: 12.5,
    d: 0.75,
    l: 'Pause',
    c: 'var(--ink-3)',
    k: 'break'
  }, {
    id: 6,
    day: 1,
    s: 9.5,
    d: 1.5,
    l: 'Finanzo Review',
    c: 'var(--project-1)',
    k: 'actual'
  }, {
    id: 7,
    day: 1,
    s: 13.25,
    d: 0.75,
    l: 'Nordwind Call',
    c: 'var(--project-3)',
    k: 'meeting',
    ext: 'Outlook'
  }, {
    id: 8,
    day: 1,
    s: 13,
    d: 2,
    l: 'Deep work: Sync engine',
    c: 'var(--project-2)',
    k: 'ghost'
  }, {
    id: 9,
    day: 1,
    s: 15.25,
    d: 0.75,
    l: 'Review backlog',
    c: 'var(--project-4)',
    k: 'ghost'
  }, {
    id: 10,
    day: 2,
    s: 9,
    d: 2,
    l: 'Nordwind Sprint',
    c: 'var(--project-3)',
    k: 'actual'
  },
  // Überbuchung — Alltag: parallel zugesagt (voll), mit Vorbehalt (schraffiert), nur FYI (blass)
  {
    id: 30,
    day: 2,
    s: 10,
    d: 1,
    l: 'Arch Sync',
    c: 'var(--project-4)',
    k: 'meeting',
    rsvp: 'tentative',
    ext: 'Outlook'
  }, {
    id: 31,
    day: 2,
    s: 10.25,
    d: 0.75,
    l: 'HR 1:1',
    c: 'var(--project-1)',
    k: 'meeting',
    rsvp: 'accepted',
    ext: 'Outlook'
  }, {
    id: 11,
    day: 2,
    s: 11.5,
    d: 1,
    l: 'Pairing',
    c: 'var(--project-2)',
    k: 'meeting',
    rsvp: 'accepted'
  }, {
    id: 32,
    day: 2,
    s: 14,
    d: 1.5,
    l: 'All-Hands',
    c: 'var(--project-3)',
    k: 'meeting',
    rsvp: 'fyi',
    ext: 'Outlook'
  }, {
    id: 12,
    day: 2,
    s: 13.5,
    d: 3,
    l: 'Deep work',
    c: 'var(--project-2)',
    k: 'ghost'
  }, {
    id: 13,
    day: 3,
    s: 9,
    d: 0.25,
    l: 'Standup',
    c: 'var(--project-1)',
    k: 'meeting',
    rec: true
  }, {
    id: 14,
    day: 3,
    s: 10,
    d: 3,
    l: 'Finanzo API',
    c: 'var(--project-1)',
    k: 'ghost'
  }, {
    id: 15,
    day: 3,
    s: 14,
    d: 1,
    l: 'Client call',
    c: 'var(--project-3)',
    k: 'meeting',
    rsvp: 'tentative',
    ext: 'Outlook'
  }, {
    id: 16,
    day: 3,
    s: 15.5,
    d: 2,
    l: 'Sync engine',
    c: 'var(--project-2)',
    k: 'ghost'
  }]);
  // All-Day-Zeile: Ganztägiges (Urlaub, Feiertag) liegt NICHT im Stundenraster
  const allDay = [{
    day: 4,
    l: 'Urlaub',
    c: 'var(--neutral-400)'
  }];
  const NOW = 14.33;
  const GUTTER = 52;
  const GAP = 10; // Luft zwischen den Tages-Spuren (Lanes statt Tabelle)
  const SOLL_WEEK = 41.67; // 5 × 8:20h
  const WEEK_BOOKED = 40.6; // gebucht + geplant (siehe Header)
  const [conflict, setConflict] = React.useState('open'); // Demo: Outlook hat den Nordwind Call verschoben
  const [overflow, setOverflow] = React.useState(null);
  const [note, setNote] = React.useState(null);
  const [taskDrag, setTaskDrag] = React.useState(null); // Inbox-Task am Cursor
  const [hoverId, setHoverId] = React.useState(null); // Hover-Pop bei gequetschten Lanes
  const [slotHover, setSlotHover] = React.useState(null); // { day, s } — „+“-Ghost auf leeren Slots
  const [resize, setResize] = React.useState(null); // { id, y0, d0 } — Dauer per Unterkante
  React.useEffect(() => {
    if (!resize) return;
    const move = e => setBlocks(bs => bs.map(b => b.id === resize.id ? {
      ...b,
      d: Math.max(0.25, Math.min(END - b.s, Math.round((resize.d0 + (e.clientY - resize.y0) / HOUR_H) * 4) / 4))
    } : b));
    const up = () => setResize(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [resize]);
  const pendingDragRef = React.useRef(null);
  const suppressClickRef = React.useRef(false);

  // ---- Task-Inbox: assigned Jira/Linear tickets land HERE, not in the
  //      calendar. Built for volume: search + filter + project groups +
  //      own scroll pane. "Planen" finds the next free slot and drops the
  //      ticket as a GHOST (proposal — you commit by leaving it). ----
  const [inboxOpen, setInboxOpen] = React.useState(true);
  const [q, setQ] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState('Alle');
  const [srcFilter, setSrcFilter] = React.useState('Alle');
  const [sortBy, setSortBy] = React.useState('prio'); // prio | est | src
  const [openTask, setOpenTask] = React.useState(null); // key → Drill-in mit Beschreibung
  const PROJ = [{
    n: 'Finanzo AG',
    c: 'var(--project-1)'
  }, {
    n: 'Sync engine',
    c: 'var(--project-2)'
  }, {
    n: 'Nordwind GmbH',
    c: 'var(--project-3)'
  }, {
    n: 'Atlas Relaunch',
    c: 'var(--project-4)'
  }];
  const [tasks, setTasks] = React.useState([{
    key: 'FIN-231',
    t: 'SEPA-Export: Sammellastschrift',
    est: 2,
    prio: 1,
    tag: 'Feature',
    p: 0,
    due: '10.7.',
    dueIn: 2,
    src: 'Jira',
    desc: 'Sammellastschriften als SEPA-XML (pain.008) exportieren. Validierung gegen Schema, Mandatsreferenz prüfen.'
  }, {
    key: 'FIN-228',
    t: 'Rundungsfehler Rechnungssumme',
    est: 1,
    prio: 1,
    tag: 'Bug',
    p: 0,
    due: '9.7.',
    dueIn: 1,
    src: 'Jira',
    desc: 'Bei 3+ Positionen mit 19%/7% MwSt weicht die Summe um 1 Cent ab. Rundung pro Position statt pro Rechnung.'
  }, {
    key: 'FIN-224',
    t: 'Audit-Log für Buchungen',
    est: 3,
    prio: 2,
    tag: 'Feature',
    p: 0,
    src: 'Jira',
    desc: 'Jede Buchungsänderung revisionssicher loggen (wer, wann, was). Export für Wirtschaftsprüfer.'
  }, {
    key: 'FIN-219',
    t: 'PR #412 reviewen',
    est: 0.5,
    prio: 2,
    tag: 'Review',
    p: 0,
    src: 'GitHub',
    desc: 'Refactoring des Invoice-Service — 400 Zeilen, 2 offene Kommentare vom Autor.'
  }, {
    key: 'FIN-215',
    t: 'Mandanten-Import CSV',
    est: 2,
    prio: 3,
    tag: 'Feature',
    p: 0,
    src: 'Jira',
    desc: 'CSV-Import mit Spalten-Mapping-UI und Dubletten-Erkennung.'
  }, {
    key: 'FIN-209',
    t: 'Flaky test: invoice.spec',
    est: 0.75,
    prio: 3,
    tag: 'Bug',
    p: 0,
    src: 'GitHub',
    desc: 'Schlägt ~1/20 Läufe fehl — vermutlich Race in der Test-Fixture.'
  }, {
    key: 'SYNC-142',
    t: 'Conflict resolution: CRDT merge',
    est: 3,
    prio: 1,
    tag: 'Feature',
    p: 1,
    due: '11.7.',
    dueIn: 3,
    src: 'Linear',
    desc: 'Merge-Strategie für konkurrierende Edits: LWW-Register durch CRDT-Sequenz ersetzen.'
  }, {
    key: 'SYNC-139',
    t: 'Offline-Queue läuft voll',
    est: 1.5,
    prio: 1,
    tag: 'Bug',
    p: 1,
    due: '9.7.',
    dueIn: 1,
    src: 'Linear',
    desc: 'Queue wächst unbegrenzt bei >2h offline. Kompaktierung + Obergrenze einziehen.'
  }, {
    key: 'SYNC-137',
    t: 'Retry-Backoff konfigurierbar',
    est: 1,
    prio: 2,
    tag: 'Feature',
    p: 1,
    src: 'Linear',
    desc: 'Exponentielles Backoff mit Jitter, per Config übersteuerbar.'
  }, {
    key: 'SYNC-133',
    t: 'PR #98 reviewen',
    est: 0.5,
    prio: 2,
    tag: 'Review',
    p: 1,
    src: 'GitHub',
    desc: 'Delta-Encoding für Sync-Payloads.'
  }, {
    key: 'SYNC-128',
    t: 'Delta-Sync Telemetrie',
    est: 2,
    prio: 3,
    tag: 'Feature',
    p: 1,
    src: 'Linear',
    desc: 'Metriken: Payload-Größe, Merge-Dauer, Konfliktrate — als Dashboard.'
  }, {
    key: 'NW-87',
    t: 'Login: SSO via Entra ID',
    est: 3,
    prio: 1,
    tag: 'Feature',
    p: 2,
    due: '17.7.',
    dueIn: 9,
    src: 'Jira',
    desc: 'OIDC-Flow gegen Entra ID, Gruppen-Mapping auf Rollen, Fallback lokaler Login.'
  }, {
    key: 'NW-85',
    t: 'Report-PDF: Umlaute kaputt',
    est: 0.75,
    prio: 2,
    tag: 'Bug',
    p: 2,
    src: 'Jira',
    desc: 'Font-Subsetting verliert ä/ö/ü bei eingebetteten Schriften.'
  }, {
    key: 'NW-82',
    t: 'Staging-Deploy reparieren',
    est: 1,
    prio: 2,
    tag: 'Bug',
    p: 2,
    src: 'GitHub',
    desc: 'Pipeline bricht beim Asset-Upload ab — S3-Credentials rotiert?'
  }, {
    key: 'NW-79',
    t: 'PR #201 reviewen',
    est: 0.5,
    prio: 3,
    tag: 'Review',
    p: 2,
    src: 'GitHub',
    desc: 'Kleines Refactoring im Report-Modul.'
  }, {
    key: 'NW-75',
    t: 'Dashboard-Widgets sortierbar',
    est: 2,
    prio: 3,
    tag: 'Feature',
    p: 2,
    src: 'Jira',
    desc: 'Drag-Sortierung + Persistenz pro Nutzer.'
  }, {
    key: '#44',
    t: 'Hero-Section CMS-Anbindung',
    est: 2,
    prio: 2,
    tag: 'Feature',
    p: 3,
    src: 'GitHub',
    desc: 'Hero-Inhalte aus dem Headless-CMS statt hartkodiert.'
  }, {
    key: '#41',
    t: 'Lighthouse: LCP > 4s mobil',
    est: 1.5,
    prio: 1,
    tag: 'Bug',
    p: 3,
    due: '10.7.',
    dueIn: 2,
    src: 'GitHub',
    desc: 'Hero-Bild unoptimiert, kein Preload. Ziel: LCP < 2,5s.'
  }, {
    key: '#39',
    t: 'Navigation: Mega-Menu A11y',
    est: 1,
    prio: 2,
    tag: 'Bug',
    p: 3,
    src: 'GitHub',
    desc: 'Fokus-Falle + fehlende aria-expanded-Attribute.'
  }, {
    key: '#36',
    t: 'PR #77 reviewen',
    est: 0.5,
    prio: 3,
    tag: 'Review',
    p: 3,
    src: 'GitHub',
    desc: 'Footer-Komponente vereinheitlicht.'
  }, {
    key: '#33',
    t: 'Bildpipeline auf AVIF',
    est: 2,
    prio: 3,
    tag: 'Feature',
    p: 3,
    src: 'GitHub',
    desc: 'Build-Step: AVIF + WebP-Fallback generieren.'
  }, {
    key: '#29',
    t: 'Cookie-Banner Consent-Mode',
    est: 1,
    prio: 3,
    tag: 'Feature',
    p: 3,
    src: 'GitHub',
    desc: 'Google Consent Mode v2 anbinden.'
  }, {
    key: 'SYNC-121',
    t: 'Changelog-Generator',
    est: 1,
    prio: 3,
    tag: 'Feature',
    p: 1,
    src: 'Linear',
    desc: 'Aus Conventional Commits ein Changelog pro Release bauen.'
  }, {
    key: 'FIN-201',
    t: 'Onboarding-Checkliste Steuerberater',
    est: 1.5,
    prio: 3,
    tag: 'Feature',
    p: 0,
    src: 'Jira',
    desc: 'Geführte Checkliste für neue StB-Mandate.'
  }]);
  const nextIdRef = React.useRef(100);
  const findSlot = est => {
    for (let day = 1; day <= 4; day++) {
      const occ = blocks.filter(b => b.day === day).map(b => [b.s, b.s + b.d]).sort((a, b2) => a[0] - b2[0]);
      let s = day === 1 ? Math.ceil(NOW * 4) / 4 + 0.25 : START;
      while (s + est <= END) {
        const clash = occ.find(([a, e]) => s < e && s + est > a);
        if (!clash) return {
          day,
          s
        };
        s = Math.ceil(clash[1] * 4) / 4;
      }
    }
    return null;
  };

  // Kapazitäts-Ehrlichkeit: passt der Task nicht mehr ins Wochen-Soll,
  // wird NICHT stillschweigend gestopft — ehrliche Wahl statt Wunschliste.
  const planTask = (task, force) => {
    const slot = findSlot(task.est);
    if (!slot) {
      setOverflow(null);
      setNote('Kein freier Slot mehr in KW 28 — „' + task.key + '“ bleibt in der Inbox.');
      return;
    }
    if (!force && WEEK_BOOKED + task.est > SOLL_WEEK) {
      setOverflow(task);
      return;
    }
    setBlocks(bs => [...bs, {
      id: nextIdRef.current++,
      day: slot.day,
      s: slot.s,
      d: task.est,
      l: task.key + ' · ' + task.t,
      c: PROJ[task.p].c,
      k: 'ghost'
    }]);
    setTasks(ts => ts.filter(x => x.key !== task.key));
    setOverflow(null);
  };
  const prioDot = {
    1: 'var(--bad)',
    2: 'var(--warn)',
    3: 'var(--ink-3)'
  };
  const sorters = {
    prio: (a, b) => a.prio - b.prio || b.est - a.est,
    due: (a, b) => (a.dueIn ?? 99) - (b.dueIn ?? 99) || a.prio - b.prio,
    est: (a, b) => b.est - a.est || a.prio - b.prio,
    src: (a, b) => a.src.localeCompare(b.src) || a.prio - b.prio
  };
  const visibleTasks = tasks.filter(t => (tagFilter === 'Alle' || t.tag === tagFilter) && (srcFilter === 'Alle' || t.src === srcFilter) && (q === '' || (t.key + ' ' + t.t).toLowerCase().includes(q.toLowerCase()))).sort(sorters[sortBy]);

  // ---- Drag & drop: grab a block, move across time AND days, snap to 15 min ----
  const bodyRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null); // { id, dy }

  const startDrag = (e, b) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({
      id: b.id,
      dy: e.clientY - rect.top
    });
  };
  React.useEffect(() => {
    if (!drag) return;
    const move = e => {
      const rect = bodyRef.current.getBoundingClientRect();
      const colW = (rect.width - GUTTER - GAP * 5) / 5;
      const day = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left - GUTTER - GAP) / (colW + GAP))));
      setBlocks(bs => bs.map(b => {
        if (b.id !== drag.id) return b;
        const raw = START + (e.clientY - rect.top - drag.dy) / HOUR_H;
        const s = Math.max(START, Math.min(END - b.d, Math.round(raw * 4) / 4));
        return {
          ...b,
          day,
          s
        };
      }));
    };
    const up = () => setDrag(null);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [drag]);

  // ---- Drag aus der Inbox in den Kalender (Motion/Sunsama-Geste):
  //      Task anfassen, über die Woche ziehen, loslassen → Ghost am 15-min-Raster ----
  React.useEffect(() => {
    const move = e => {
      const p = pendingDragRef.current;
      if (!p) return;
      if (!p.active) {
        if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 6) {
          p.active = true;
          suppressClickRef.current = true;
          setTaskDrag({
            task: p.task,
            x: e.clientX,
            y: e.clientY
          });
        }
      } else {
        setTaskDrag(d => d ? {
          ...d,
          x: e.clientX,
          y: e.clientY
        } : d);
      }
    };
    const up = e => {
      const p = pendingDragRef.current;
      pendingDragRef.current = null;
      if (!p || !p.active) return;
      setTaskDrag(null);
      const el = bodyRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (e.clientX > rect.left + GUTTER && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom) {
          const t = p.task;
          const colW = (rect.width - GUTTER - GAP * 5) / 5;
          const day = Math.max(0, Math.min(4, Math.floor((e.clientX - rect.left - GUTTER - GAP) / (colW + GAP))));
          const s = Math.max(START, Math.min(END - t.est, Math.round((START + (e.clientY - rect.top) / HOUR_H) * 4) / 4));
          setBlocks(bs => [...bs, {
            id: nextIdRef.current++,
            day,
            s,
            d: t.est,
            l: t.key + ' · ' + t.t,
            c: PROJ[t.p].c,
            k: 'ghost'
          }]);
          setTasks(ts => ts.filter(x => x.key !== t.key));
          window.dtToast && window.dtToast(t.key + ' eingeplant — ' + ['Mo', 'Di', 'Mi', 'Do', 'Fr'][day] + ' ' + String(Math.floor(s)).padStart(2, '0') + ':' + String(Math.round(s % 1 * 60)).padStart(2, '0'), () => {
            setBlocks(bs => bs.filter(b => b.l !== t.key + ' · ' + t.t));
            setTasks(ts => [...ts, t]);
          });
        }
      }
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  // Überbuchung: überlappende Blöcke teilen sich die Tagesspalte in Lanes
  const laneMap = React.useMemo(() => {
    const m = {};
    for (let day = 0; day < 5; day++) {
      const db = blocks.filter(b => b.day === day).sort((a, b) => a.s - b.s || b.d - a.d);
      let cluster = [],
        clusterEnd = -1;
      const flush = () => {
        const lanes = [];
        cluster.forEach(b => {
          let li = lanes.findIndex(end => end <= b.s + 0.001);
          if (li === -1) {
            li = lanes.length;
            lanes.push(0);
          }
          lanes[li] = b.s + b.d;
          m[b.id] = {
            lane: li,
            of: 1
          };
        });
        cluster.forEach(b => {
          m[b.id].of = lanes.length;
        });
        cluster = [];
      };
      db.forEach(b => {
        if (cluster.length && b.s >= clusterEnd - 0.001) {
          flush();
          clusterEnd = -1;
        }
        cluster.push(b);
        clusterEnd = Math.max(clusterEnd, b.s + b.d);
      });
      if (cluster.length) flush();
    }
    return m;
  }, [blocks]);
  const blockStyle = (b, dragging, hovered) => {
    const tiny = b.d < 0.5;
    const ln = laneMap[b.id] || {
      lane: 0,
      of: 1
    };
    const pop = hovered && ln.of > 1 && !dragging; // gequetschter Block klappt auf volle Breite auf
    const base = {
      position: 'absolute',
      left: pop || ln.of === 1 ? 4 : 'calc(4px + (100% - 8px) * ' + ln.lane / ln.of + ')',
      width: pop || ln.of === 1 ? 'calc(100% - 8px)' : 'calc((100% - 8px) / ' + ln.of + ' - 2px)',
      top: (b.s - START) * HOUR_H + 1,
      height: b.d * HOUR_H - 3,
      borderRadius: tiny ? 5 : 'var(--radius-block)',
      padding: tiny ? 0 : '5px 8px',
      overflow: 'hidden',
      boxSizing: 'border-box',
      fontSize: 'var(--fs-2xs)',
      lineHeight: 1.25,
      cursor: dragging ? 'grabbing' : 'grab',
      userSelect: 'none',
      zIndex: dragging ? 10 : pop ? 8 : b.rsvp === 'fyi' ? 0 : 1,
      boxShadow: dragging || pop ? 'var(--shadow-lg)' : hovered ? 'var(--shadow-md, 0 2px 10px rgba(0,0,0,.10))' : 'none',
      transform: dragging ? 'scale(1.03)' : 'scale(1)',
      transition: dragging ? 'none' : 'top var(--dur-med) var(--ease-spring), left var(--dur-fast) var(--ease-out), width var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out)'
    };
    if (b.k === 'break') return {
      ...base,
      background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 5px, transparent 5px 10px)',
      border: '1px dashed var(--border-strong)',
      color: 'var(--ink-3)'
    };
    if (b.k === 'ghost') return {
      ...base,
      border: '1.5px dashed ' + b.c,
      background: dragging ? 'var(--surface)' : 'transparent',
      color: 'var(--ink-2)'
    };
    if (b.k === 'meeting') {
      if (b.rsvp === 'tentative') return {
        ...base,
        background: 'repeating-linear-gradient(135deg, color-mix(in srgb, ' + b.c + ' 22%, var(--surface)) 0 5px, var(--surface) 5px 10px)',
        border: '1.5px solid ' + b.c,
        color: 'var(--ink)'
      };
      if (b.rsvp === 'fyi') return {
        ...base,
        border: '1px dotted var(--border-strong)',
        background: 'var(--surface-sunk)',
        color: 'var(--ink-3)',
        zIndex: 0
      };
      return {
        ...base,
        background: b.c,
        color: '#fff'
      };
    }
    // Task/Gebucht: sattere Tönung + Hover sättigt weiter auf — lebendig in der Interaktion
    const tint = hovered || dragging ? 30 : 21;
    return {
      ...base,
      background: 'color-mix(in srgb, ' + b.c + ' ' + tint + '%, var(--surface))',
      borderLeft: '4px solid ' + b.c,
      color: 'var(--ink)'
    };
  };
  const fmtT = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round(h % 1 * 60)).padStart(2, '0');
  // Warmes Grundrauschen: Hauch Ember-Orange (--live) im Raster — --accent ist im Default-Theme blau
  const WARM = 'color-mix(in srgb, var(--live) 2.5%, var(--surface))';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
      flexWrap: 'wrap',
      rowGap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      flex: 1,
      minWidth: 160
    }
  }, "Planner"), /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    items: [{
      value: 'week',
      label: 'Woche'
    }, {
      value: 'month',
      label: 'Monat'
    }, {
      value: 'year',
      label: 'Jahr'
    }],
    active: view,
    onChange: setView
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '4px 6px',
      background: 'var(--surface)',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 8px'
    }
  }, "\u2039"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, view === 'week' ? 'KW 28' : view === 'month' ? 'Juli 2026' : '2026'), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 8px'
    }
  }, "\u203A")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, "26,1h"), " / 41:40h"), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: inboxOpen ? 'primary' : 'ghost',
    onClick: () => setInboxOpen(!inboxOpen)
  }, "Inbox \xB7 ", tasks.length)), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm"
  }, "Woche planen"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16,
      maxWidth: 680
    }
  }, /*#__PURE__*/React.createElement(AIAskBar, {
    scopes: ['Zeiten', 'Budgets'],
    answers: {
      "Wo wird's diese Woche eng?": 'Donnerstag: 9,3h geplant bei 8:20h Soll — und der Nordwind-Block (2h) würde das Restbudget (7,2h) auf 5,2h drücken. Vorschlag: Review-Block auf Freitagvormittag ziehen.',
      'Schaffe ich mein Wochen-Soll?': 'Knapp: 26,1h gebucht + 14,5h geplant = 40,6h bei 41:40h Soll. Es fehlen ~1h — Freitag ist noch frei bis auf Urlaub.'
    }
  })), conflict === 'open' && view === 'week' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      marginBottom: 12,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--live-border)',
      background: 'var(--live-soft)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--live)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Konflikt:"), " \u201ENordwind Call\u201C (Outlook) wurde auf 13:15 verschoben \u2014 kollidiert mit \u201EDeep work: Sync engine\u201C."), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => {
      setBlocks(bs => bs.map(b => b.id === 8 ? {
        ...b,
        s: 14.5
      } : b.id === 9 ? {
        ...b,
        s: 16.5
      } : b));
      setConflict('done');
    }
  }, "\u2726 Woche neu legen"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => setConflict(null)
  }, "Ignorieren"))), conflict === 'done' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      marginBottom: 12,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'color-mix(in srgb, var(--good) 8%, var(--surface))',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, "\u2726 2 Bl\xF6cke neu gelegt \u2014 als Ghost-Vorschlag. Passt es, lass sie einfach stehen.", /*#__PURE__*/React.createElement("button", {
    onClick: () => setConflict(null),
    style: {
      marginLeft: 'auto',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 13
    }
  }, "\xD7")), overflow && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      marginBottom: 12,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid color-mix(in srgb, var(--warn) 45%, transparent)',
      background: 'color-mix(in srgb, var(--warn) 10%, var(--surface))',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Woche voll:"), " \u201E", overflow.key, "\u201C (", overflow.est, "h) sprengt das Soll \u2014 40,6h geplant + ", overflow.est, "h > 41:40h."), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => {
      const k = overflow.key;
      setTasks(ts => ts.filter(x => x.key !== k));
      setOverflow(null);
      setNote('„' + k + '“ für KW 29 vorgemerkt — taucht dort als Vorschlag auf.');
    }
  }, "\u2192 KW 29 planen"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => planTask(overflow, true)
  }, "Trotzdem planen"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => setOverflow(null)
  }, "Abbrechen"))), note && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      marginBottom: 12,
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)',
      background: 'var(--surface)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, "\u2726 ", note, /*#__PURE__*/React.createElement("button", {
    onClick: () => setNote(null),
    style: {
      marginLeft: 'auto',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 13
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      gap: 16,
      margin: '0 -28px',
      padding: '2px 28px 0',
      overflow: 'hidden'
    }
  }, inboxOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 268,
      flexShrink: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 12px 10px',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, "Inbox"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-3)',
      background: 'var(--surface-sunk)',
      borderRadius: 'var(--radius-pill)',
      padding: '2px 8px',
      fontVariantNumeric: 'tabular-nums'
    }
  }, visibleTasks.length, visibleTasks.length !== tasks.length ? '/' + tasks.length : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 9,
      fontWeight: 600,
      color: 'var(--ink-3)'
    }
  }, "3 Quellen \xB7 vor 2 min")), /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: "Suchen (Key, Titel) \u2026",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '8px 11px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-strong)',
      background: 'var(--surface-sunk)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-2xs)',
      outline: 'none',
      fontFamily: 'var(--font-ui)',
      marginBottom: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginBottom: 6
    }
  }, ['Alle', 'Bug', 'Feature', 'Review'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setTagFilter(f),
    style: {
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      fontSize: 10,
      fontWeight: 700,
      border: tagFilter === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: tagFilter === f ? 'var(--accent-soft)' : 'var(--surface)',
      color: tagFilter === f ? 'var(--accent-strong)' : 'var(--ink-2)'
    }
  }, f))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginRight: 2
    }
  }, "Quelle"), ['Alle', 'Jira', 'Linear', 'GitHub'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setSrcFilter(f),
    style: {
      padding: '3px 9px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      fontSize: 10,
      fontWeight: 700,
      border: srcFilter === f ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: srcFilter === f ? 'var(--accent-soft)' : 'var(--surface)',
      color: srcFilter === f ? 'var(--accent-strong)' : 'var(--ink-2)'
    }
  }, f))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginRight: 2
    }
  }, "Sortieren"), [['prio', 'Priorität'], ['due', 'Deadline'], ['est', 'Aufwand'], ['src', 'Quelle']].map(([id, label]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setSortBy(id),
    style: {
      padding: '3px 9px',
      borderRadius: 'var(--radius-pill)',
      cursor: 'pointer',
      fontSize: 10,
      fontWeight: 700,
      border: sortBy === id ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: sortBy === id ? 'var(--accent-soft)' : 'var(--surface)',
      color: sortBy === id ? 'var(--accent-strong)' : 'var(--ink-2)'
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '6px 8px 10px'
    }
  }, PROJ.map((proj, pi) => {
    const group = visibleTasks.filter(t => t.p === pi);
    if (group.length === 0) return null;
    return /*#__PURE__*/React.createElement("div", {
      key: proj.n
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 6px 5px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 3,
        background: proj.c,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--ink-2)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--ls-wide)'
      }
    }, proj.n), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        color: 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, group.length)), group.map(t => /*#__PURE__*/React.createElement("div", {
      key: t.key
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 6px',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer'
      },
      onMouseDown: e => {
        if (e.target.tagName === 'BUTTON') return;
        pendingDragRef.current = {
          x: e.clientX,
          y: e.clientY,
          task: t,
          active: false
        };
      },
      onClick: () => {
        if (suppressClickRef.current) return;
        setOpenTask(openTask === t.key ? null : t.key);
      },
      onMouseEnter: e => {
        e.currentTarget.style.background = 'var(--surface-sunk)';
        e.currentTarget.querySelectorAll('button').forEach(x => {
          x.style.opacity = 1;
        });
      },
      onMouseLeave: e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.querySelectorAll('button').forEach(x => {
          x.style.opacity = 0;
        });
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        setTasks(ts => ts.filter(x => x.key !== t.key));
      },
      title: "Erledigt",
      style: {
        opacity: 0,
        transition: 'opacity var(--dur-fast) var(--ease-out)',
        width: 15,
        height: 15,
        borderRadius: 5,
        border: '1.5px solid var(--border-strong)',
        background: 'var(--surface)',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'transparent',
        fontSize: 9,
        fontWeight: 800
      },
      onMouseEnter: e => {
        e.currentTarget.style.background = 'var(--good)';
        e.currentTarget.style.borderColor = 'var(--good)';
        e.currentTarget.style.color = '#fff';
      },
      onMouseLeave: e => {
        e.currentTarget.style.background = 'var(--surface)';
        e.currentTarget.style.borderColor = 'var(--border-strong)';
        e.currentTarget.style.color = 'transparent';
      }
    }, "\u2713"), /*#__PURE__*/React.createElement("span", {
      title: 'Priorität P' + t.prio,
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 8.5,
        fontWeight: 800,
        color: t.prio === 1 ? '#fff' : 'var(--ink-2)',
        background: t.prio === 1 ? 'var(--bad)' : 'var(--surface-sunk)',
        border: t.prio === 1 ? 'none' : '1px solid var(--border)',
        borderRadius: 4,
        padding: '1px 4px',
        flexShrink: 0,
        boxSizing: 'border-box'
      }
    }, "P", t.prio), /*#__PURE__*/React.createElement("span", {
      title: t.src,
      style: {
        width: 15,
        height: 15,
        borderRadius: 4,
        background: 'var(--surface-sunk)',
        border: '1px solid var(--border)',
        boxSizing: 'border-box',
        color: 'var(--ink-3)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8.5,
        fontWeight: 800,
        fontFamily: 'var(--font-display)',
        flexShrink: 0
      }
    }, t.src[0]), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--ink-3)',
        flexShrink: 0
      }
    }, t.key), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, t.t), t.due && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        fontWeight: 700,
        flexShrink: 0,
        color: t.dueIn <= 2 ? 'var(--bad)' : t.dueIn <= 5 ? 'var(--warn)' : 'var(--ink-3)'
      }
    }, "\u25B8 ", t.due))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0
      }
    }, t.est, "h"), /*#__PURE__*/React.createElement("button", {
      onClick: e => {
        e.stopPropagation();
        planTask(t);
      },
      style: {
        opacity: 0,
        transition: 'opacity var(--dur-fast) var(--ease-out)',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        padding: '3px 9px',
        fontSize: 10,
        fontWeight: 700,
        background: 'var(--accent)',
        color: '#fff',
        cursor: 'pointer',
        flexShrink: 0
      }
    }, "\u2726 Planen")), openTask === t.key && /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '0 6px 6px 6px',
        padding: '8px 10px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-sunk)',
        border: '1px solid var(--border)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        lineHeight: 1.5
      }
    }, t.desc), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        marginTop: 6,
        fontSize: 9,
        color: 'var(--ink-3)',
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, /*#__PURE__*/React.createElement("span", null, "P", t.prio), /*#__PURE__*/React.createElement("span", null, t.est, "h gesch\xE4tzt"), t.due && /*#__PURE__*/React.createElement("span", null, "f\xE4llig ", t.due), /*#__PURE__*/React.createElement("span", null, t.tag), /*#__PURE__*/React.createElement("span", null, t.src))))));
  }), visibleTasks.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 10px',
      textAlign: 'center',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Nichts gefunden \u2014 Filter oder Suche anpassen.")), /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      borderTop: '1px solid var(--border)',
      padding: '8px 12px',
      fontSize: 9,
      color: 'var(--ink-3)',
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2713 hakt ab \xB7 Task antippen \u2192 Beschreibung \xB7 \u201E\u2726 Planen\u201C legt einen Ghost in den n\xE4chsten freien Slot"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      overflowY: 'auto',
      paddingBottom: 8
    }
  }, view === 'month' && /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement(window.PlannerMonth, {
    onDrill: () => setView('week')
  })), view === 'year' && /*#__PURE__*/React.createElement(window.PlannerYear, {
    onDrill: () => setView('month')
  }), view === 'week' && /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-block-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } } @media (prefers-reduced-motion: reduce) { .dt-block { animation: none !important; } }'), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 12px 14px',
      background: WARM,
      borderRadius: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)',
      columnGap: GAP,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", null), days.map((d, di) => {
    // Überbuchungs-Hinweis: zählt echte Konflikte (FYI & Pausen zählen nicht)
    const real = blocks.filter(b => b.day === di && b.k !== 'break' && b.rsvp !== 'fyi');
    const clash = real.some(a => real.some(b => a.id < b.id && a.s < b.s + b.d && b.s < a.s + a.d));
    return /*#__PURE__*/React.createElement("div", {
      key: d.name,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
        padding: '2px 2px 6px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        padding: '3px 11px',
        borderRadius: 'var(--radius-pill)',
        background: d.today ? 'var(--accent)' : 'transparent',
        color: d.today ? 'var(--accent-contrast, #fff)' : 'var(--ink)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 700,
        whiteSpace: 'nowrap'
      }
    }, d.name, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--fs-2xs)',
        fontWeight: 500,
        opacity: d.today ? 0.85 : 0.55
      }
    }, d.date)), clash && /*#__PURE__*/React.createElement("span", {
      title: "\xDCberbucht \u2014 zwei aktive Zusagen \xFCberlappen",
      style: {
        fontSize: 9,
        fontWeight: 800,
        color: 'var(--warn)',
        background: 'var(--warn-soft)',
        borderRadius: 'var(--radius-pill)',
        padding: '1px 7px',
        whiteSpace: 'nowrap'
      }
    }, "2\xD7"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap'
      }
    }, d.total));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)',
      columnGap: GAP,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: 'var(--ink-3)'
    }
  }, "ganzt."), days.map((d, di) => {
    const ad = allDay.find(a => a.day === di);
    return /*#__PURE__*/React.createElement("div", {
      key: d.name,
      style: {
        minHeight: 24,
        boxSizing: 'border-box'
      }
    }, ad && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        borderRadius: 7,
        padding: '3px 9px',
        fontSize: 10,
        fontWeight: 700,
        background: 'color-mix(in srgb, ' + ad.c + ' 18%, var(--surface))',
        border: '1px solid color-mix(in srgb, ' + ad.c + ' 40%, transparent)',
        color: 'var(--ink-2)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, "\u25E6 ", ad.l));
  })), /*#__PURE__*/React.createElement("div", {
    ref: bodyRef,
    style: {
      display: 'grid',
      gridTemplateColumns: GUTTER + 'px repeat(5, 1fr)',
      columnGap: GAP
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: colH
    }
  }, hours.slice(0, -1).map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      position: 'absolute',
      top: (h - START) * HOUR_H - 7,
      right: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, h === START ? '' : String(h).padStart(2, '0') + ':00'))), days.map((d, di) => /*#__PURE__*/React.createElement("div", {
    key: d.name,
    style: {
      position: 'relative',
      height: colH,
      borderRadius: 12,
      background: d.today ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'color-mix(in srgb, var(--live) 2%, var(--surface-sunk))'
    }
  }, hours.slice(1, -1).map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      position: 'absolute',
      top: (h - START) * HOUR_H,
      left: 6,
      right: 6,
      borderTop: '1px solid var(--border)',
      opacity: 0.4
    }
  })), hours.slice(0, -1).map(h => /*#__PURE__*/React.createElement("div", {
    key: 'half' + h,
    style: {
      position: 'absolute',
      top: (h - START + 0.5) * HOUR_H,
      left: 6,
      right: 6,
      borderTop: '1px dotted var(--border)',
      opacity: 0.25
    }
  })), d.today && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: (NOW - START) * HOUR_H,
      background: 'color-mix(in srgb, var(--surface) 45%, transparent)',
      zIndex: 2,
      pointerEvents: 'none',
      borderRadius: '12px 12px 0 0'
    }
  }), !drag && !resize && !taskDrag && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0
    },
    onMouseMove: e => {
      const r = e.currentTarget.getBoundingClientRect();
      const s = Math.max(START, Math.min(END - 0.5, Math.floor((START + (e.clientY - r.top) / HOUR_H) * 2) / 2));
      const free = !blocks.some(b => b.day === di && s < b.s + b.d && s + 0.5 > b.s);
      setSlotHover(free ? {
        day: di,
        s
      } : null);
    },
    onMouseLeave: () => setSlotHover(null),
    onClick: () => {
      if (!slotHover || slotHover.day !== di) return;
      const s = slotHover.s;
      setBlocks(bs => [...bs, {
        id: nextIdRef.current++,
        day: di,
        s,
        d: 1,
        l: 'Neuer Eintrag',
        c: 'var(--project-2)',
        k: 'actual'
      }]);
      window.dtToast && window.dtToast('Eintrag angelegt — ' + fmtT(s) + '–' + fmtT(s + 1), () => setBlocks(bs => bs.slice(0, -1)));
      setSlotHover(null);
    }
  }, slotHover && slotHover.day === di && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: (slotHover.s - START) * HOUR_H + 1,
      left: 4,
      right: 4,
      height: HOUR_H - 3,
      borderRadius: 'var(--radius-block)',
      border: '1.5px dashed var(--accent)',
      background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: 'var(--accent)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      cursor: 'copy'
    }
  }, "+ ", fmtT(slotHover.s))), blocks.filter(b => b.day === di).map(b => {
    const dragging = drag && drag.id === b.id;
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      className: "dt-block",
      style: {
        ...blockStyle(b, dragging, hoverId === b.id),
        animation: 'dt-block-in var(--dur-med) var(--ease-spring) backwards'
      },
      onMouseDown: e => startDrag(e, b),
      onMouseEnter: () => setHoverId(b.id),
      onMouseLeave: () => setHoverId(null),
      title: b.l + ' · ' + fmtT(b.s) + '–' + fmtT(b.s + b.d)
    }, (dragging || resize && resize.id === b.id) && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -22,
        left: 4,
        zIndex: 12,
        padding: '2px 8px',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--ink)',
        color: 'var(--bg)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--shadow-lg)'
      }
    }, fmtT(b.s), "\u2013", fmtT(b.s + b.d)), b.d >= 0.65 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, b.rec && /*#__PURE__*/React.createElement("span", {
      title: "Wiederkehrend",
      style: {
        opacity: 0.7,
        marginRight: 3
      }
    }, "\u21BB"), b.ext && /*#__PURE__*/React.createElement("span", {
      title: 'Aus ' + b.ext + ' synchronisiert (Microsoft Graph) — ⇄ zwei-Wege: DevTime schreibt Fokuszeit zurück',
      style: {
        fontSize: 8,
        fontWeight: 800,
        border: '1px solid currentColor',
        borderRadius: 3,
        padding: '0 3px',
        marginRight: 4,
        opacity: 0.85
      }
    }, "\u21C4 OL"), b.rsvp === 'tentative' && /*#__PURE__*/React.createElement("span", {
      title: "Mit Vorbehalt zugesagt",
      style: {
        fontSize: 8,
        fontWeight: 800,
        border: '1px solid currentColor',
        borderRadius: 3,
        padding: '0 3px',
        marginRight: 4,
        opacity: 0.85
      }
    }, "?"), b.rsvp === 'fyi' && /*#__PURE__*/React.createElement("span", {
      title: "Nur zur Info \u2014 keine Teilnahme, z\xE4hlt nicht als Arbeitszeit",
      style: {
        fontSize: 8,
        fontWeight: 800,
        border: '1px dotted currentColor',
        borderRadius: 3,
        padding: '0 3px',
        marginRight: 4,
        opacity: 0.85
      }
    }, "FYI"), b.l), b.d >= 0.9 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        opacity: 0.75,
        fontVariantNumeric: 'tabular-nums'
      }
    }, fmtT(b.s), "\u2013", fmtT(b.s + b.d)), b.k !== 'break' && /*#__PURE__*/React.createElement("div", {
      onMouseDown: e => {
        e.stopPropagation();
        e.preventDefault();
        setResize({
          id: b.id,
          y0: e.clientY,
          d0: b.d
        });
      },
      title: "Dauer \xE4ndern",
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 7,
        cursor: 'ns-resize'
      }
    }));
  }), d.today && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: (NOW - START) * HOUR_H,
      left: 0,
      right: 0,
      zIndex: 4,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      background: 'var(--live)',
      boxShadow: '0 0 8px rgba(255,83,32,0.6)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -3,
      top: -4,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: 'var(--live)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 4,
      top: -9,
      padding: '1px 7px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--live)',
      color: 'var(--live-contrast)',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, "14:20"))))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18,
      padding: '10px 0 14px',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      alignItems: 'center',
      flexWrap: 'wrap',
      flexShrink: 0,
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 10,
      borderRadius: 3,
      background: 'color-mix(in srgb, var(--project-2) 21%, var(--surface))',
      borderLeft: '4px solid var(--project-2)'
    }
  }), " Task / Gebucht"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 10,
      borderRadius: 3,
      background: 'var(--project-3)'
    }
  }), " Meeting"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 10,
      borderRadius: 3,
      border: '1.5px dashed var(--project-4)'
    }
  }), " Vorschlag (Ghost)"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontStyle: 'italic',
      color: 'var(--project-11, #7c6cf3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 10,
      borderRadius: 3,
      border: '1px dashed var(--project-11, #7c6cf3)',
      boxSizing: 'border-box'
    }
  }), " Event \u2014 z\xE4hlt nicht, blockiert nicht"), view === 'week' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      background: 'var(--live)'
    }
  }), " Jetzt"), view === 'month' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 3,
      borderRadius: 2,
      background: 'var(--warn)'
    }
  }), " Tag-Schwere (prio-gewichtet vs. Soll)"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      color: 'var(--ink-3)'
    }
  }, view === 'week' ? 'Blöcke & Inbox-Tasks ziehen · 15-min-Raster · ↻ wiederkehrend · OL = Outlook · ? = Vorbehalt · FYI = ohne Teilnahme · überlappende Blöcke teilen sich die Spalte' : view === 'month' ? 'Tag anklicken → Woche' : 'Monat anklicken → Monat')), taskDrag && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: taskDrag.x + 10,
      top: taskDrag.y + 8,
      zIndex: 100,
      pointerEvents: 'none',
      padding: '6px 10px',
      borderRadius: 'var(--radius-lg)',
      border: '1.5px dashed ' + PROJ[taskDrag.task.p].c,
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-lg)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, taskDrag.task.key, " \xB7 ", taskDrag.task.est, "h"));
}
window.PlannerScreen = PlannerScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/PlannerScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/PlannerViews.jsx
try { (() => {
// PlannerViews — Monat- und Jahres-Facette des Planners.
// Grundgesetz beider Ansichten: TASKS (geplante Arbeit, zählen in die
// Auslastung) und EVENTS (Feiertag, Firmen-Event, Info — zählen NIE,
// blockieren NIE) sind auf den ersten Blick unterscheidbar:
//   Task  = gefüllter Chip mit Projektfarbe + Prio-Punkt
//   Event = flaches Banner GANZ OBEN in der Zelle, Wimpel-Glyph, kein Fill
// Tag-Schwere: Balken unten in jeder Zelle — prio-gewichtete Stunden vs. Soll.

const FlagGlyph = ({
  color = 'var(--violet, #7c6cf3)'
}) => /*#__PURE__*/React.createElement("svg", {
  width: "8",
  height: "10",
  viewBox: "0 0 8 10",
  style: {
    flexShrink: 0,
    display: 'block'
  }
}, /*#__PURE__*/React.createElement("path", {
  d: "M1 0.5 V9.5 M1 1 H7 L5.4 2.9 L7 4.8 H1",
  fill: "none",
  stroke: color,
  strokeWidth: "1.4",
  strokeLinejoin: "round",
  strokeLinecap: "round"
}));
const EVENT_C = 'var(--project-11, #7c6cf3)';

// prio-gewichtete Schwere: P1 wiegt 1.4, P2 1.0, P3 0.7
const dayLoad = tasks => tasks.reduce((s, t) => s + t.est * (t.prio === 1 ? 1.4 : t.prio === 2 ? 1 : 0.7), 0);
const loadColor = (load, soll) => load === 0 ? 'var(--border)' : load <= soll * 0.85 ? 'var(--good)' : load <= soll ? 'var(--warn)' : 'var(--bad)';

// ---------- MONAT ----------
function PlannerMonth({
  onDrill
}) {
  const SOLL = 8.33;
  // Juli 2026: 1.7. = Mittwoch → Offset 2 (Mo-Start). 31 Tage.
  const OFFSET = 2,
    DAYS = 31,
    TODAY = 13;
  // Deterministische Demo-Daten. t: [prio, est, label, projektfarbe]
  const D = {
    1: {
      t: [[2, 2, 'Finanzo API', 1], [3, 1, 'PR-Reviews', 4]]
    },
    2: {
      t: [[1, 3, 'Sync: CRDT merge', 2], [2, 1.5, 'Staging-Deploy', 3]]
    },
    3: {
      t: [[2, 2, 'Audit-Log', 1]],
      e: ['Sommerfest (nachm.)']
    },
    6: {
      t: [[1, 2.5, 'SSO Entra ID', 3], [2, 2, 'Finanzo Review', 1], [3, 0.5, 'PR #412', 4]]
    },
    7: {
      t: [[1, 3, 'Offline-Queue', 2], [2, 1, 'Retry-Backoff', 2]]
    },
    8: {
      t: [[2, 2, 'Rundungsfehler', 1], [2, 1.5, 'Report-PDF', 3], [3, 1, 'Changelog', 2]]
    },
    9: {
      t: [[1, 2, 'LCP mobil', 4], [3, 0.5, 'PR #77', 4]]
    },
    10: {
      t: [[2, 2, 'Mandanten-Import', 1]]
    },
    13: {
      t: [[1, 2, 'Sync engine', 2], [2, 1.5, 'Finanzo Review', 1], [2, 0.75, 'Nordwind Call', 3], [3, 0.75, 'Review backlog', 4]]
    },
    14: {
      t: [[1, 3, 'Deep work: Sync', 2], [2, 1, 'Pairing', 2]],
      e: ['Zahnarzt 16:30']
    },
    15: {
      t: [[1, 3, 'Finanzo API', 1], [2, 1, 'Client call', 3], [1, 2, 'Sync engine', 2]]
    },
    16: {
      t: [[2, 2.5, 'Nordwind Sprint', 3], [3, 1, 'Dashboard-Widgets', 3]]
    },
    17: {},
    20: {
      t: [[2, 2, 'Hero-Section CMS', 4], [2, 1, 'Mega-Menu A11y', 4]]
    },
    21: {
      t: [[1, 3, 'SEPA-Export', 1], [3, 0.75, 'Flaky test', 1]]
    },
    22: {
      t: [[2, 2, 'Delta-Sync Telemetrie', 2]],
      e: ['Meetup Freiburg 19:00']
    },
    23: {
      t: [[2, 2.5, 'Onboarding-Checkliste', 1], [3, 1, 'Cookie-Banner', 4]]
    },
    24: {
      t: [[3, 1.5, 'Bildpipeline AVIF', 4]]
    },
    27: {
      t: [[1, 2.5, 'Sync: Konflikt-UI', 2], [2, 2, 'Audit-Log II', 1]]
    },
    28: {
      t: [[2, 2, 'Nordwind Review', 3]]
    },
    29: {
      t: [[1, 2, 'Release 1.4 vorbereiten', 2], [2, 1, 'PR-Sweep', 4]],
      e: ['Release-Day']
    },
    30: {
      t: [[3, 1, 'Docs-Pass', 2]]
    },
    31: {}
  };
  // Urlaub Fr 17.7. + Feiertage als Events
  const HOLIDAY = {
    17: 'Urlaub'
  };
  const PC = {
    1: 'var(--project-1)',
    2: 'var(--project-2)',
    3: 'var(--project-3)',
    4: 'var(--project-4)'
  };
  const prioDot = {
    1: 'var(--bad)',
    2: 'var(--warn)',
    3: 'var(--ink-3)'
  };
  const cells = [];
  for (let i = 0; i < OFFSET; i++) cells.push(null);
  for (let d = 1; d <= DAYS; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      borderBottom: '1px solid var(--border)'
    }
  }, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    style: {
      padding: '8px 10px',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)'
    }
  }, cells.map((d, i) => {
    if (d === null) return /*#__PURE__*/React.createElement("div", {
      key: 'x' + i,
      style: {
        minHeight: 96,
        borderBottom: '1px solid var(--border)',
        borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)',
        background: 'var(--surface-sunk)',
        opacity: 0.4
      }
    });
    const wk = i % 7 >= 5;
    const info = D[d] || {};
    const tasks = (info.t || []).map(([prio, est, l, p]) => ({
      prio,
      est,
      l,
      p
    }));
    const events = [...(info.e || []), ...(HOLIDAY[d] ? [HOLIDAY[d]] : [])];
    const load = dayLoad(tasks);
    const isToday = d === TODAY;
    const shown = tasks.slice(0, 3);
    return /*#__PURE__*/React.createElement("div", {
      key: d,
      onClick: () => onDrill && onDrill(d),
      style: {
        minHeight: 96,
        padding: '6px 7px 8px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)',
        background: isToday ? 'color-mix(in srgb, var(--accent-soft) 55%, transparent)' : wk ? 'color-mix(in srgb, var(--surface-sunk) 45%, transparent)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        position: 'relative',
        transition: 'background var(--dur-fast) var(--ease-out)'
      },
      onMouseEnter: e => {
        if (!isToday) e.currentTarget.style.background = 'var(--surface-sunk)';
      },
      onMouseLeave: e => {
        if (!isToday) e.currentTarget.style.background = wk ? 'color-mix(in srgb, var(--surface-sunk) 45%, transparent)' : 'transparent';
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: isToday ? 700 : 600,
        fontVariantNumeric: 'tabular-nums',
        color: isToday ? '#fff' : wk ? 'var(--ink-3)' : 'var(--ink-2)',
        background: isToday ? 'var(--live)' : 'transparent',
        borderRadius: 'var(--radius-pill)',
        padding: isToday ? '1px 7px' : '1px 0'
      }
    }, d), load > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--ink-3)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, load.toFixed(1).replace('.', ','))), events.map(ev => /*#__PURE__*/React.createElement("span", {
      key: ev,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        border: '1px dashed ' + EVENT_C,
        color: EVENT_C,
        fontSize: 9.5,
        fontWeight: 600,
        fontStyle: 'italic',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        background: 'transparent',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement(FlagGlyph, {
      color: EVENT_C
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, ev))), shown.map((t, ti) => /*#__PURE__*/React.createElement("span", {
      key: ti,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        background: 'color-mix(in srgb, ' + PC[t.p] + ' 15%, var(--surface))',
        borderLeft: '2.5px solid ' + PC[t.p],
        color: 'var(--ink)',
        fontSize: 9.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 5,
        height: 5,
        borderRadius: '50%',
        background: prioDot[t.prio],
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, t.l))), tasks.length > 3 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--ink-3)'
      }
    }, "+", tasks.length - 3, " weitere"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginTop: 'auto',
        height: 3,
        borderRadius: 2,
        background: 'var(--surface-sunk)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        width: Math.min(load / SOLL, 1) * 100 + '%',
        height: '100%',
        borderRadius: 2,
        background: loadColor(load, SOLL)
      }
    })));
  })));
}

// ---------- JAHR ----------
function PlannerYear({
  onDrill
}) {
  const MONTHS = [{
    n: 'Jan',
    h: 152,
    load: [2, 2, 1, 2, 1],
    ev: 1
  }, {
    n: 'Feb',
    h: 148,
    load: [2, 1, 2, 2, 0],
    ev: 0
  }, {
    n: 'Mär',
    h: 166,
    load: [2, 3, 2, 2, 1],
    ev: 1
  }, {
    n: 'Apr',
    h: 141,
    load: [1, 2, 2, 1, 1],
    ev: 2
  }, {
    n: 'Mai',
    h: 155,
    load: [2, 2, 3, 2, 1],
    ev: 2
  }, {
    n: 'Jun',
    h: 172,
    load: [3, 3, 2, 3, 2],
    ev: 0
  }, {
    n: 'Jul',
    h: 76,
    load: [2, 3, 0, 0, 0],
    ev: 3,
    now: true
  }, {
    n: 'Aug',
    h: 0,
    load: [1, 0, 0, 0, 0],
    ev: 1
  }, {
    n: 'Sep',
    h: 0,
    load: [1, 1, 0, 0, 0],
    ev: 0
  }, {
    n: 'Okt',
    h: 0,
    load: [0, 0, 0, 0, 0],
    ev: 1
  }, {
    n: 'Nov',
    h: 0,
    load: [0, 0, 0, 0, 0],
    ev: 0
  }, {
    n: 'Dez',
    h: 0,
    load: [0, 0, 0, 0, 0],
    ev: 2
  }];
  const heat = ['var(--surface-sunk)', 'color-mix(in srgb, var(--accent) 25%, var(--surface))', 'color-mix(in srgb, var(--accent) 55%, var(--surface))', 'var(--accent)'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 12,
      padding: '14px 0'
    }
  }, MONTHS.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.n,
    onClick: () => onDrill && onDrill(m.n),
    style: {
      border: m.now ? '1.5px solid var(--live-border)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-card)',
      padding: '12px 14px',
      cursor: 'pointer',
      background: 'var(--surface)',
      boxShadow: m.now ? '0 8px 24px -12px rgba(255,83,32,0.35)' : 'none',
      transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = m.now ? '0 8px 24px -12px rgba(255,83,32,0.35)' : 'none';
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-sm)',
      color: m.now ? 'var(--live)' : 'var(--ink)'
    }
  }, m.n), m.now && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      fontWeight: 800,
      color: 'var(--live)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "Jetzt"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, m.h > 0 ? m.h + 'h' : '—')), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, m.load.map((lv, wi) => /*#__PURE__*/React.createElement("span", {
    key: wi,
    style: {
      height: 6,
      borderRadius: 2,
      background: heat[lv],
      transition: 'background var(--dur-med) var(--ease-out)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      marginTop: 10,
      minHeight: 12
    }
  }, Array.from({
    length: m.ev
  }).map((_, i) => /*#__PURE__*/React.createElement(FlagGlyph, {
    key: i,
    color: EVENT_C
  })), m.ev > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--ink-3)',
      fontStyle: 'italic'
    }
  }, m.ev, " Event", m.ev > 1 ? 's' : '')))));
}
Object.assign(window, {
  PlannerMonth,
  PlannerYear,
  DTFlagGlyph: FlagGlyph
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/PlannerViews.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/ProfileScreen.jsx
try { (() => {
function ProfileScreen({
  theme,
  setTheme,
  mode,
  setMode
}) {
  const {
    Card,
    Switch,
    StatTile,
    Badge,
    Button
  } = window.MyDevTimeDesignSystem_254296;
  const [reminders, setReminders] = React.useState(true);
  const [autoCapture, setAutoCapture] = React.useState(true);
  const [autoTracker, setAutoTracker] = React.useState(true);
  const [calRead, setCalRead] = React.useState(true);
  const [calWrite, setCalWrite] = React.useState(true);
  const [calPrivate, setCalPrivate] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      flex: 1
    }
  }, "Profil & Einstellungen")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      margin: '0 -28px',
      padding: '4px 28px 28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 340px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 16,
      flexShrink: 0,
      background: 'linear-gradient(135deg, #3D5CF5, #2941B8)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 18
    }
  }, "SS"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: 'var(--ink)'
    }
  }, "Suhay Sevinc"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      marginTop: 2
    }
  }, "suhay@mydevtime.app")), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "Pro"))), /*#__PURE__*/React.createElement(Card, {
    title: "Darstellung"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Accent"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['blueprint', 'Königsblau'], ['sovereign', 'Sovereign'], ['ember', 'Ember']].map(([t, label]) => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTheme && setTheme(t),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      padding: '9px 10px',
      borderRadius: 'var(--radius-block)',
      cursor: 'pointer',
      border: '1.5px solid ' + (theme === t ? 'var(--accent)' : 'var(--border)'),
      background: theme === t ? 'var(--accent-soft)' : 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: t === 'blueprint' ? 'var(--blueprint-500)' : t === 'sovereign' ? 'var(--sovereign-500)' : 'var(--ember-500)'
    }
  }), label)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--ink-2)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Modus"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['light', 'Hell'], ['dark', 'Dunkel']].map(([m, label]) => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMode && setMode(m),
    style: {
      flex: 1,
      padding: '9px 10px',
      borderRadius: 'var(--radius-block)',
      cursor: 'pointer',
      border: '1.5px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
      background: mode === m ? 'var(--accent-soft)' : 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      transition: 'border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)'
    }
  }, label)))))), /*#__PURE__*/React.createElement(Card, {
    title: "Arbeitszeit",
    subtitle: "REQ-028 \xB7 ArbZG \xA74"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, "Soll pro Tag"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)',
      padding: '2px 4px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 9px'
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "8:20h"), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-2)',
      fontSize: 14,
      padding: '2px 9px'
    }
  }, "+"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: -8
    }
  }, "8:00h + 15 min/Tag Vorarbeit f\xFCr Betriebsschlie\xDFtage"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, "Wochen-Soll"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "41:40h")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, "Wochenmodell"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: d,
    style: {
      width: 26,
      height: 26,
      borderRadius: 8,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 700,
      background: i < 5 ? 'var(--accent-soft)' : 'var(--surface-sunk)',
      color: i < 5 ? 'var(--accent-strong)' : 'var(--ink-3)'
    }
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink-2)'
    }
  }, "\xDCberstunden-Saldo"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-md)',
      fontWeight: 700,
      color: 'var(--good)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, "+9:30h")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Pausenwarnungen folgen dem ArbZG-\xA74-Preset \u2014 ein Hinweis, keine Rechtsberatung."))), /*#__PURE__*/React.createElement(Card, {
    title: "Einstellungen"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: reminders,
    onChange: setReminders,
    label: "Pausen-Erinnerungen (ArbZG)"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: autoCapture,
    onChange: setAutoCapture,
    label: "Kalender-Auto-Erfassung"
  }), /*#__PURE__*/React.createElement(Switch, {
    checked: autoTracker,
    onChange: setAutoTracker,
    label: "Auto-Tracker (App-Nutzung aufzeichnen)"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 280px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Kalender-Sync",
    subtitle: "Outlook \xB7 Microsoft Graph"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'var(--ink)',
      color: 'var(--surface)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12,
      flexShrink: 0
    }
  }, "O"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, "suhay.sevinc@firma.de"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Zuletzt synchronisiert vor 2 min")), /*#__PURE__*/React.createElement(Badge, {
    tone: "good"
  }, "Verbunden")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)',
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: 'var(--accent-strong)',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "STUFE 1 \xB7 LESEN"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: calRead,
    onChange: setCalRead,
    label: ""
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, "Termine erscheinen im Planner als ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      fontWeight: 800,
      border: '1px solid currentColor',
      borderRadius: 3,
      padding: '0 3px'
    }
  }, "OL"), "-Bl\xF6cke \u2014 read-only. Verschiebungen l\xF6sen den Konflikt-Check aus.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)',
      border: '1px solid var(--border)',
      opacity: calRead ? 1 : 0.45,
      transition: 'opacity var(--dur-med) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 800,
      color: 'var(--accent-strong)',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "STUFE 2 \xB7 SCHREIBEN"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: calRead && calWrite,
    onChange: v => calRead && setCalWrite(v),
    label: ""
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginBottom: calRead && calWrite ? 10 : 0
    }
  }, "Geplante DevTime-Bl\xF6cke landen als Fokuszeit in Outlook \u2014 Kollegen sehen dich belegt, Meeting-Einladungen weichen aus. Bl\xF6cke mit ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)'
    }
  }, "\u21C4"), " sind zwei-Wege."), calRead && calWrite && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      borderTop: '1px solid var(--border)',
      paddingTop: 10
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    checked: calPrivate,
    onChange: setCalPrivate,
    label: "Privacy: nur \u201EBelegt\u201C \u2014 ohne Titel & Projekt"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Projekte, die geschrieben werden:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      flexWrap: 'wrap'
    }
  }, [['Finanzo AG', 'var(--project-1)', true], ['Sync engine', 'var(--project-2)', true], ['Nordwind', 'var(--project-3)', true], ['Atlas', 'var(--project-4)', false]].map(([n, c, on]) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 'var(--radius-pill)',
      fontSize: 10,
      fontWeight: 700,
      cursor: 'pointer',
      border: on ? '1.5px solid var(--accent)' : '1px solid var(--border)',
      background: on ? 'var(--accent-soft)' : 'var(--surface)',
      color: on ? 'var(--accent-strong)' : 'var(--ink-3)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: c,
      opacity: on ? 1 : 0.4
    }
  }), n))))))), /*#__PURE__*/React.createElement(Card, {
    title: "Integrationen",
    subtitle: "Export nur nach Best\xE4tigung \u2014 nie automatisch"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [['GitHub', 'Action Items → Issues · Commits als Zeitvorschlag', true], ['Jira', 'Action Items → Tickets', true], ['Linear', 'Action Items → Issues', false], ['Slack', 'Insights → Channel', true]].map(([name, desc, on]) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: 'var(--ink)',
      color: 'var(--surface)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 12,
      flexShrink: 0
    }
  }, name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, desc)), /*#__PURE__*/React.createElement(Badge, {
    tone: on ? 'good' : 'neutral'
  }, on ? 'Verbunden' : 'Verbinden'))))), /*#__PURE__*/React.createElement(Card, {
    title: "AI-Credits",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary"
    }, "Aufladen")
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Guthaben",
    value: "34",
    mono: true
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Abwesenheiten"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "18 / 30 Tage"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, "Urlaub verbleibend")))))));
}
window.ProfileScreen = ProfileScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/ProjectsScreen.jsx
try { (() => {
function ProjectsScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Card,
    BudgetRing,
    WeekSparkline,
    Badge,
    Button
  } = DS;
  const EmptyState = DS.EmptyState || (({
    title,
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("div", null, children)));
  const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('');
  // B8: Kunde → Projekt-Hierarchie. Abrechnung läuft auf Kundenebene (B4).
  const clients = [{
    name: 'Finanzo AG',
    meta: 'Retainer · 78€/h',
    color: 'var(--project-1)',
    openH: 18.5,
    openEur: '1.443€',
    projects: [{
      name: 'Website Relaunch',
      pct: 62,
      color: 'var(--project-1)',
      spark: [6, 7.5, 8, 5, 7, 2, 0],
      hours: '96,5h',
      budget: '160h'
    }, {
      name: 'Support-Retainer',
      pct: 41,
      color: 'var(--project-1)',
      spark: [1, 2, 1, 2, 1, 0, 0],
      hours: '8,2h',
      budget: '20h/Monat'
    }]
  }, {
    name: 'Nordwind GmbH',
    meta: 'Fixed scope',
    color: 'var(--project-3)',
    openH: 12.8,
    openEur: '—  (Festpreis)',
    projects: [{
      name: 'Nordwind App',
      pct: 91,
      color: 'var(--project-3)',
      spark: [3, 4, 5, 6, 4, 0, 0],
      hours: '72,8h',
      budget: '80h'
    }]
  }, {
    name: 'Atlas Kollektiv',
    meta: 'T&M · 92€/h',
    color: 'var(--project-4)',
    openH: 14.5,
    openEur: '1.334€',
    projects: [{
      name: 'Atlas Relaunch',
      pct: 18,
      color: 'var(--project-4)',
      spark: [0, 1, 2, 3, 2, 4, 0],
      hours: '14,5h',
      budget: '80h'
    }]
  }, {
    name: 'Intern',
    meta: 'Kein Budget-Cap · nicht abrechenbar',
    color: 'var(--project-2)',
    openH: 0,
    openEur: null,
    projects: [{
      name: 'Sync engine',
      pct: 34,
      color: 'var(--project-2)',
      spark: [2, 3, 2, 4, 3, 1, 0],
      hours: '41,2h',
      budget: '—'
    }]
  }];
  // B4: Positionen der offenen Abrechnung (Mock, Juni-Zeitraum)
  const initialEntries = [{
    id: 1,
    date: 'Mo 06.07.',
    proj: 'Website Relaunch',
    note: 'Checkout-Flow refactoring',
    h: '6,5h',
    billable: true
  }, {
    id: 2,
    date: 'Di 07.07.',
    proj: 'Website Relaunch',
    note: 'Review + Deploy',
    h: '3,0h',
    billable: true
  }, {
    id: 3,
    date: 'Mi 08.07.',
    proj: 'Support-Retainer',
    note: 'Hotfix Login',
    h: '1,5h',
    billable: true
  }, {
    id: 4,
    date: 'Do 09.07.',
    proj: 'Website Relaunch',
    note: 'Interner Sync',
    h: '0,5h',
    billable: false
  }, {
    id: 5,
    date: 'Fr 10.07.',
    proj: 'Website Relaunch',
    note: 'CMS-Migration',
    h: '7,0h',
    billable: true
  }];
  const [billing, setBilling] = React.useState(null); // client currently being billed
  const [entries, setEntries] = React.useState(initialEntries);
  const [checked, setChecked] = React.useState(() => new Set(initialEntries.filter(e => e.billable).map(e => e.id)));
  const [billed, setBilled] = React.useState(false); // demo: Finanzo Juni schon abgerechnet?
  const [showEmpty, setShowEmpty] = React.useState(false); // C9 preview
  const toggle = id => setChecked(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const sumH = entries.filter(e => checked.has(e.id)).reduce((a, e) => a + parseFloat(e.h.replace(',', '.')), 0);
  const exportBill = kind => {
    setBilled(true);
    setBilling(null);
    window.dtToast && window.dtToast('Abrechnung Finanzo AG · Juli (' + String(sumH).replace('.', ',') + 'h) als ' + kind + ' exportiert — Einträge als abgerechnet markiert', () => setBilled(false));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      flex: 1
    }
  }, "Projects"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowEmpty(v => !v),
    title: "Erster-Start-Zustand ansehen (Design-Preview)",
    style: {
      border: '1px dashed var(--border-strong)',
      background: 'none',
      color: 'var(--ink-3)',
      fontSize: 'var(--fs-2xs)',
      borderRadius: 999,
      padding: '4px 10px',
      cursor: 'pointer'
    }
  }, showEmpty ? 'Demo-Daten' : 'Minute 1'), /*#__PURE__*/React.createElement(Button, {
    size: "sm"
  }, "Neuer Kunde"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Neues Projekt")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      margin: '0 -28px',
      padding: '4px 28px 28px'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-card-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { .dt-card-in { animation: none !important; } }'), showEmpty ? /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(EmptyState, {
    icon: "folder",
    title: "Noch keine Kunden oder Projekte",
    hint: "Lege einen Kunden an \u2014 Projekte, Stundens\xE4tze und Abrechnung h\xE4ngen daran. Oder importiere Projekte direkt aus Jira/GitHub.",
    action: /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Button, {
      size: "sm"
    }, "Ersten Kunden anlegen"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary"
    }, "Aus Jira importieren"))
  })) : clients.map((c, ci) => /*#__PURE__*/React.createElement("div", {
    key: c.name,
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 8,
      background: 'color-mix(in srgb, ' + c.color + ' 16%, var(--surface))',
      color: c.color,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 11
    }
  }, initials(c.name)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: 'var(--ink)'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, c.meta), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), c.openEur !== null && (c.name === 'Finanzo AG' && billed ? /*#__PURE__*/React.createElement(Badge, {
    tone: "ok"
  }, "Juli abgerechnet") : c.openH > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--ink)'
    }
  }, String(c.openH).replace('.', ','), "h"), " offen", c.openEur && c.openEur.indexOf('—') !== 0 ? ' · ' + c.openEur : ''), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    onClick: () => c.name === 'Finanzo AG' && setBilling(c)
  }, "Abrechnung erstellen")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16
    }
  }, c.projects.map((p, idx) => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    className: "dt-card-in",
    style: {
      transition: 'transform var(--dur-fast) var(--ease-out)',
      animation: 'dt-card-in var(--dur-slow) var(--ease-out) backwards ' + (ci * 2 + idx) * 60 + 'ms'
    },
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'translateY(0)';
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 'var(--fs-md)',
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, p.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)',
      marginTop: 2
    }
  }, c.meta)), p.pct >= 80 && /*#__PURE__*/React.createElement(Badge, {
    tone: "warn"
  }, "Budget knapp")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(BudgetRing, {
    percent: p.pct,
    color: p.color,
    size: 72
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-2)'
    }
  }, "Gebucht"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--ink)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, p.hours)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--fs-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-2)'
    }
  }, "Budget"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--ink)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums'
    }
  }, p.budget)), /*#__PURE__*/React.createElement(WeekSparkline, {
    values: p.spark,
    color: p.color,
    width: 150,
    height: 30
  })))))))))), billing && /*#__PURE__*/React.createElement("div", {
    onClick: () => setBilling(null),
    style: {
      position: 'fixed',
      inset: 0,
      background: 'color-mix(in srgb, var(--ink) 32%, transparent)',
      zIndex: 60,
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: 520,
      maxWidth: '92vw',
      height: '100%',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-modal, -8px 0 40px rgba(0,0,0,.18))',
      display: 'flex',
      flexDirection: 'column',
      animation: 'dt-card-in var(--dur-med) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px 14px',
      borderBottom: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      color: 'var(--ink)'
    }
  }, "Abrechnung \xB7 Finanzo AG"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 10
    }
  }, ['Juli 2026', 'Juni 2026', 'Eigener Zeitraum'].map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    style: {
      border: i === 0 ? '1.5px solid var(--accent)' : '1px solid var(--border-strong)',
      background: i === 0 ? 'var(--accent-soft, color-mix(in srgb, var(--accent) 10%, var(--surface)))' : 'none',
      color: i === 0 ? 'var(--accent)' : 'var(--ink-2)',
      fontWeight: i === 0 ? 700 : 500,
      fontSize: 'var(--fs-xs)',
      borderRadius: 999,
      padding: '5px 12px',
      cursor: 'pointer'
    }
  }, p)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '10px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      margin: '8px 0'
    }
  }, "Positionen pr\xFCfen \u2014 abw\xE4hlen, was nicht auf die Rechnung soll. Nicht-billable Eintr\xE4ge sind vorab abgew\xE4hlt."), entries.map(e => /*#__PURE__*/React.createElement("label", {
    key: e.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
      cursor: 'pointer',
      opacity: checked.has(e.id) ? 1 : 0.45
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked.has(e.id),
    onChange: () => toggle(e.id),
    style: {
      accentColor: 'var(--accent)',
      width: 16,
      height: 16
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      width: 62,
      flexShrink: 0
    }
  }, e.date), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.note), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, e.proj)), !e.billable && /*#__PURE__*/React.createElement(Badge, null, "nicht billable"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 700,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, e.h)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px 20px',
      borderTop: '1px solid var(--border)',
      background: 'var(--surface-sunk)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, checked.size, " Positionen \xB7 78\u20AC/h"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      color: 'var(--ink)'
    }
  }, String(Math.round(sumH * 10) / 10).replace('.', ','), "h \xB7 ", Math.round(sumH * 78).toLocaleString('de-DE'), "\u20AC")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => exportBill('PDF'),
    style: {
      flex: 1
    }
  }, "Als PDF exportieren"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => exportBill('CSV')
  }, "CSV"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    onClick: () => setBilling(null)
  }, "Abbrechen"))))));
}
window.ProjectsScreen = ProjectsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/ProjectsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/ReportsScreen.jsx
try { (() => {
function useCountUp(target, duration = 700) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf, start;
    const step = t => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// Donut — SVG stroke segments, center = total. Every figure clickable in the
// real product (auditability as UX); here the legend carries the numbers.
function ProjectDonut({
  data,
  total
}) {
  const R = 56,
    C = 2 * Math.PI * R;
  let acc = 0;
  const sum = data.reduce((s, d) => s + d.h, 0);
  const [drawn, setDrawn] = React.useState(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(() => {
    if (drawn) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(raf);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 150,
      height: 150,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 150 150",
    style: {
      width: '100%',
      transform: 'rotate(-90deg)'
    }
  }, data.map((d, i) => {
    const frac = drawn ? d.h / sum : 0;
    const seg = /*#__PURE__*/React.createElement("circle", {
      key: d.n,
      cx: "75",
      cy: "75",
      r: R,
      fill: "none",
      stroke: d.c,
      strokeWidth: "16",
      strokeDasharray: Math.max(frac * C - 3, 0.01) + ' ' + (C - frac * C + 3),
      strokeDashoffset: -acc * C,
      style: {
        transition: 'stroke-dasharray var(--dur-slow) var(--ease-out) ' + i * 130 + 'ms, stroke-dashoffset var(--dur-slow) var(--ease-out) ' + i * 130 + 'ms'
      }
    });
    acc += frac;
    return seg;
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-lg)',
      fontWeight: 700,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, total), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      fontWeight: 700
    }
  }, "gearbeitet"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, data.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: d.c,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink)',
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, d.n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, d.h, "h"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums',
      width: 34,
      textAlign: 'right'
    }
  }, Math.round(d.h / data.reduce((s, x) => s + x.h, 0) * 100), "%")))));
}
function ReportsScreen() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    Card,
    StatTile,
    BoxPlot,
    Heatmap,
    WeekSparkline,
    Tabs,
    Button
  } = DS;
  const AIAskBar = DS.AIAskBar || (() => null);
  const LoadMeter = DS.LoadMeter || (() => null);
  const CheckinCard = DS.CheckinCard || (() => null);
  const [checkedIn, setCheckedIn] = React.useState(false);
  const AICallout = DS.AICallout || (({
    title,
    children,
    action
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      border: '1px solid var(--accent-border)',
      borderRadius: 'var(--radius-card)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, title && /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, title, " "), children), action));
  const [range, setRange] = React.useState('week');
  const [selDay, setSelDay] = React.useState(9); // index in month grid — 'heute'

  // Every figure from the deterministic core — the view only formats.
  const DATA = {
    week: {
      label: 'KW 28',
      worked: 41.25,
      workedLabel: '41:15h',
      billablePct: 79,
      revenue: '2.540 €',
      overtime: '+1:30h',
      overtimeH: 1.5,
      donut: [{
        n: 'Finanzo AG',
        h: 14.5,
        c: 'var(--project-1)'
      }, {
        n: 'Sync engine',
        h: 12.3,
        c: 'var(--project-2)'
      }, {
        n: 'Nordwind GmbH',
        h: 8.2,
        c: 'var(--project-3)'
      }, {
        n: 'Atlas Relaunch',
        h: 6.3,
        c: 'var(--project-4)'
      }],
      burn: {
        pts: '0,42 30,46 60,52 90,56 120,61 150,66',
        win: 'Run-Rate dieser Woche (ø 1,6h/Tag)',
        tasks: [[2, 1], [1, 2], [1, 1], [1, 0]],
        neu: 5,
        zu: 4,
        fazit: 'diese Woche fast im Gleichgewicht.'
      }
    },
    month: {
      label: 'Juli 2026',
      worked: 168,
      workedLabel: '168:20h',
      billablePct: 78,
      revenue: '10.940 €',
      overtime: '+4:30h',
      overtimeH: 4.5,
      donut: [{
        n: 'Finanzo AG',
        h: 58,
        c: 'var(--project-1)'
      }, {
        n: 'Sync engine',
        h: 46,
        c: 'var(--project-2)'
      }, {
        n: 'Nordwind GmbH',
        h: 38,
        c: 'var(--project-3)'
      }, {
        n: 'Atlas Relaunch',
        h: 26,
        c: 'var(--project-4)'
      }],
      burn: {
        pts: '0,10 30,16 60,28 90,34 120,52 150,66',
        win: 'Run-Rate der letzten 14 Tage (ø 1,9h/Tag)',
        tasks: [[5, 4], [3, 4], [4, 3], [2, 3]],
        neu: 14,
        zu: 11,
        fazit: 'der Backlog wächst schneller als das Budget.'
      }
    },
    year: {
      label: '2026',
      worked: 1642,
      workedLabel: '1.642h',
      billablePct: 73,
      revenue: '94.800 €',
      overtime: '+9:30h',
      overtimeH: 9.5,
      donut: [{
        n: 'Finanzo AG',
        h: 612,
        c: 'var(--project-1)'
      }, {
        n: 'Nordwind GmbH',
        h: 388,
        c: 'var(--project-3)'
      }, {
        n: 'Sync engine',
        h: 296,
        c: 'var(--project-2)'
      }, {
        n: 'Atlas Relaunch',
        h: 214,
        c: 'var(--project-4)'
      }, {
        n: 'Intern & Sonstige',
        h: 132,
        c: 'var(--project-11)'
      }],
      burn: {
        pts: '0,4 30,10 60,20 90,32 120,50 150,66',
        win: 'Verlauf seit Projektstart (Feb 2026)',
        tasks: [[9, 7], [11, 10], [8, 9], [6, 5]],
        neu: 34,
        zu: 31,
        fazit: 'übers Jahr stabil — der Engpass ist das Stundenbudget, nicht der Backlog.'
      }
    }
  };
  const d = DATA[range];
  const worked = useCountUp(d.worked);
  const fmtWorked = range === 'year' ? Math.round(worked).toLocaleString('de-DE') + 'h' : Math.floor(worked) + ':' + String(Math.round(worked % 1 * 60)).padStart(2, '0') + 'h';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1120,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)',
      flex: 1
    }
  }, "Reports"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost"
  }, range === 'year' ? 'Jahresbericht' : 'Monatsbericht', " exportieren")), /*#__PURE__*/React.createElement(Tabs, {
    items: [{
      value: 'week',
      label: 'Woche'
    }, {
      value: 'month',
      label: 'Monat'
    }, {
      value: 'year',
      label: 'Jahr'
    }],
    active: range,
    onChange: setRange
  }), /*#__PURE__*/React.createElement("div", {
    key: range,
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      margin: '0 -28px',
      padding: '0 28px 28px'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } } .dt-rise { animation: dt-rise var(--dur-slow) var(--ease-out) both; } @keyframes dt-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } } .dt-draw { animation: dt-draw 900ms var(--ease-out) both 150ms; } @keyframes dt-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } } .dt-grow { transform-box: fill-box; transform-origin: bottom; animation: dt-grow var(--dur-slow) var(--ease-spring) both; } @keyframes dt-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } } .dt-pop { transform-box: fill-box; transform-origin: center; animation: dt-pop var(--dur-med) var(--ease-spring) both; } @media (prefers-reduced-motion: reduce) { .dt-rise, .dt-draw, .dt-grow, .dt-pop { animation: none; } }'), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '16px 0 0',
      maxWidth: 680
    }
  }, /*#__PURE__*/React.createElement(AIAskBar, {
    scopes: ['Projekte', 'Umsatz', 'Saldo'],
    answers: {
      'Welches Projekt frisst mein Budget?': 'Nordwind: 91% des 80h-Budgets verbraucht, Run-Rate 1,9h/Tag — erschöpft ~21.7. Alle anderen Projekte liegen unter 65%.',
      'Wie stehe ich beim Überstunden-Saldo?': '+9:30h Jahressaldo. Dein Median-Tag liegt bei 8:24h, 4 Minuten über Soll — der Saldo wächst also langsam weiter.'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "dt-rise",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
      gap: 12,
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: 'Gearbeitet · ' + d.label,
    value: fmtWorked
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Billable-Quote",
    value: d.billablePct + '%',
    delta: range === 'week' ? 4 : 2
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Umsatz",
    value: d.revenue.replace(' ', '\u00A0'),
    delta: range === 'year' ? 18 : 6
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Saldo",
    value: d.overtime
  })), /*#__PURE__*/React.createElement("div", {
    className: "dt-rise",
    style: {
      marginTop: 12,
      animationDelay: '60ms'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Balance",
    subtitle: d.label + ' · Belastung aus deinen eigenen Daten — keine Diagnose'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      flexWrap: 'wrap',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '0 1 300px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(LoadMeter, {
    score: range === 'week' ? 64 : range === 'month' ? 55 : 47,
    width: 300
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 6
    }
  }, "Verlauf \xB7 10 Wochen"), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 300 56",
    style: {
      width: '100%',
      maxWidth: 300,
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "25",
    x2: "300",
    y2: "25",
    stroke: "var(--warn)",
    strokeWidth: "1",
    strokeDasharray: "3 4",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("text", {
    x: "298",
    y: "20",
    textAnchor: "end",
    fontFamily: "var(--font-mono)",
    fontSize: "8",
    fill: "var(--ink-3)"
  }, "erh\xF6ht"), /*#__PURE__*/React.createElement("polyline", {
    className: "dt-draw",
    pathLength: "1",
    strokeDasharray: "1",
    style: {
      animationDuration: '1100ms'
    },
    points: "0,44 33,46 66,41 99,43 132,38 165,40 198,34 231,30 264,26 297,21",
    fill: "none",
    stroke: "var(--warn)",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), [[0, 44], [33, 46], [66, 41], [99, 43], [132, 38], [165, 40], [198, 34], [231, 30], [264, 26]].map(([cx, cy], i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    className: "dt-pop",
    style: {
      animationDelay: 150 + i * 95 + 'ms'
    },
    cx: cx,
    cy: cy,
    r: "2.5",
    fill: "var(--surface)",
    stroke: "var(--warn)",
    strokeWidth: "1.5"
  })), /*#__PURE__*/React.createElement("circle", {
    className: "dt-pop",
    style: {
      animationDelay: '1050ms'
    },
    cx: "297",
    cy: "21",
    r: "4",
    fill: "var(--warn)"
  }), [33, 99, 165, 231, 297].map((cx, i) => /*#__PURE__*/React.createElement("rect", {
    key: cx,
    className: "dt-pop",
    style: {
      animationDelay: 400 + i * 90 + 'ms'
    },
    x: cx - 2,
    y: "50",
    width: "4",
    height: "4",
    rx: "1",
    fill: "var(--accent)",
    opacity: "0.7"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)',
      marginTop: 4
    }
  }, "Linie = passive Signale \xB7 ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "\u25AA"), " = deine Check-ins"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: '1 1 260px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [['warn', '3. Woche in Folge über Soll', '+1:30h · +2:10h · +1:05h'], ['warn', '2× Pause übersprungen', 'Di · Do'], ['warn', 'Erholungsfenster schrumpft', 'ø 12:10h zwischen Feierabend & Start'], ['good', 'Keine Abend-Sessions', 'letzte nach 20 Uhr: vor 9 Tagen'], ['good', 'Meeting-Anteil gesund', '22% — unter deinem 30%-Limit']].map(([tone, label, detail]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tone === 'warn' ? 'var(--warn)' : 'var(--good)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, detail))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 12,
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      marginBottom: 8
    }
  }, "Wochen-Check-in"), /*#__PURE__*/React.createElement(CheckinCard, {
    compact: true,
    onDone: () => setCheckedIn(true)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(AICallout, {
    compact: true,
    title: checkedIn ? 'Dein Check-in bestätigt die Daten.' : 'Deine Belastung steigt seit drei Wochen.',
    action: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm"
    }, "\u2726 In Planner \xFCbernehmen"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost"
    }, "Sp\xE4ter"))
  }, checkedIn ? 'Du meldest Erschöpfung 4/5 — und die passiven Signale zeigen die dritte Woche über Soll, das passt zusammen. Vorschlag: Donnerstag meetingfrei, Feierabend-Ghost 17:30, Reviews auf Freitagvormittag.' : 'Vorschlag für nächste Woche: Donnerstag meetingfrei halten, Feierabend-Ghost um 17:30 setzen und die zwei Review-Blöcke auf Freitagvormittag ziehen — das bringt dich rechnerisch zurück auf Soll.')))), /*#__PURE__*/React.createElement("div", {
    className: "dt-rise",
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 12,
      flexWrap: 'wrap',
      animationDelay: '120ms'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Wohin ging die Zeit?",
    subtitle: d.label + ' · nach Projekt',
    style: {
      flex: '1.3 1 340px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(ProjectDonut, {
    data: d.donut,
    total: d.workedLabel
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Budget burn-down",
    subtitle: "Nordwind GmbH \xB7 80h fixed",
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600,
        color: 'var(--warn)',
        background: 'var(--warn-soft)',
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, "ersch\xF6pft ~21.7."),
    style: {
      flex: '1 1 300px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 300 110",
    style: {
      width: '100%',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "100",
    x2: "300",
    y2: "100",
    stroke: "var(--border)",
    strokeWidth: "1"
  }), [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: "0",
    y1: 10 + i * 30,
    x2: "300",
    y2: 10 + i * 30,
    stroke: "var(--border)",
    strokeWidth: "0.5",
    opacity: "0.5"
  })), /*#__PURE__*/React.createElement("style", null, '@media (prefers-reduced-motion: reduce) { .dt-draw { animation: none !important; stroke-dashoffset: 0 !important; } }'), /*#__PURE__*/React.createElement("polyline", {
    className: "dt-draw",
    points: d.burn.pts,
    fill: "none",
    stroke: "var(--project-3)",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    pathLength: "1",
    strokeDasharray: "1",
    style: {
      animation: 'dt-draw 900ms var(--ease-out) both 150ms'
    }
  }), /*#__PURE__*/React.createElement("polyline", {
    className: "dt-draw",
    points: "150,66 210,84 258,100",
    fill: "none",
    stroke: "var(--project-3)",
    strokeWidth: "2",
    strokeDasharray: "5 5",
    opacity: "0.55",
    style: {
      animation: 'none'
    }
  }), /*#__PURE__*/React.createElement("circle", {
    className: "dt-pop",
    style: {
      animationDelay: '950ms'
    },
    cx: "150",
    cy: "66",
    r: "4",
    fill: "var(--live)"
  }), /*#__PURE__*/React.createElement("text", {
    x: "4",
    y: "24",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fill: "var(--ink-3)"
  }, "80h"), /*#__PURE__*/React.createElement("text", {
    x: "130",
    y: "108",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fill: "var(--live)"
  }, "heute"), /*#__PURE__*/React.createElement("text", {
    x: "248",
    y: "94",
    fontFamily: "var(--font-mono)",
    fontSize: "9",
    fill: "var(--ink-3)"
  }, "21.7.")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 8
    }
  }, d.burn.win, " \u2014 Fenster + Rate sichtbar, keine falsche Pr\xE4zision."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginTop: 12,
      paddingTop: 12,
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 120 40",
    style: {
      width: 120,
      flexShrink: 0
    }
  }, d.burn.tasks.map(([neu, zu], w) => /*#__PURE__*/React.createElement("g", {
    key: w,
    transform: 'translate(' + (w * 30 + 4) + ',0)'
  }, /*#__PURE__*/React.createElement("rect", {
    className: "dt-grow",
    style: {
      animationDelay: 200 + w * 90 + 'ms'
    },
    x: "0",
    y: 36 - Math.min(neu, 11) * 3,
    width: "8",
    height: Math.min(neu, 11) * 3,
    rx: "2",
    fill: "var(--accent)",
    opacity: "0.85"
  }), /*#__PURE__*/React.createElement("rect", {
    className: "dt-grow",
    style: {
      animationDelay: 245 + w * 90 + 'ms'
    },
    x: "11",
    y: 36 - Math.min(zu, 11) * 3,
    width: "8",
    height: Math.min(zu, 11) * 3,
    rx: "2",
    fill: "var(--good)",
    opacity: "0.85"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontFamily: 'var(--font-mono)'
    }
  }, d.burn.neu), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)'
    }
  }, "\u25A0"), " neue Aufgaben \xB7 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontFamily: 'var(--font-mono)'
    }
  }, d.burn.zu), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--good)'
    }
  }, "\u25A0"), " geschlossen \u2014 ", d.burn.fazit)))), /*#__PURE__*/React.createElement("div", {
    className: "dt-rise",
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 12,
      flexWrap: 'wrap',
      animationDelay: '180ms'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Tagesarbeitszeit",
    subtitle: d.label + ' · Verteilung vs. Soll 8:20h',
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        fontWeight: 600,
        color: 'var(--good)',
        background: 'var(--good-soft)',
        padding: '3px 10px',
        borderRadius: 'var(--radius-pill)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, "Saldo ", d.overtime),
    style: {
      flex: '1 1 300px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(BoxPlot, {
    min: range === 'year' ? 5.5 : 6.2,
    q1: range === 'year' ? 7.4 : 7.5,
    median: range === 'year' ? 8.3 : 8.4,
    q3: range === 'year' ? 9.0 : 9.2,
    max: range === 'year' ? 11.5 : 10.75,
    target: 8.33,
    width: 320
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      marginTop: 4
    }
  }, "Die Box ist dein typischer Tag (25\u201375%), der Strich der Median, orange das Soll \u2014 liegt die Box rechts davon, baust du \xDCberstunden auf.")), range === 'week' && /*#__PURE__*/React.createElement(Card, {
    title: "Fokus-Stunden",
    subtitle: "T\xE4glich, diese Woche",
    style: {
      flex: '1 1 300px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(WeekSparkline, {
    values: [6, 7.5, 8, 5, 7, 2, 0]
  })), range === 'month' && /*#__PURE__*/React.createElement(Card, {
    title: "Monats\xFCbersicht",
    subtitle: "Juli 2026 \xB7 Tag antippen f\xFCr Eintr\xE4ge",
    style: {
      flex: '1 1 300px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: 4,
      maxWidth: 260
    }
  }, [null, null, 1, 2, 3, 0, 0, 2, 3, 'now', -1, 0, 0, 0, 1, 2, 2, 3, 1, 0, 0, 2, 1, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0].map((v, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    disabled: v === null,
    onClick: () => setSelDay(i),
    style: {
      aspectRatio: '1',
      borderRadius: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: v === null ? 'transparent' : v === 'now' ? 'var(--live)' : 'var(--surface-sunk)',
      border: v === -1 ? '1.5px dashed var(--warn)' : selDay === i ? '2px solid var(--accent)' : '2px solid transparent',
      boxSizing: 'border-box',
      cursor: v === null ? 'default' : 'pointer',
      padding: 0
    }
  }, typeof v === 'number' && v > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4 + v * 1.5,
      height: 4 + v * 1.5,
      borderRadius: '50%',
      background: 'var(--accent)',
      opacity: 0.35 + v * 0.2
    }
  })))), (() => {
    const grid = [null, null, 1, 2, 3, 0, 0, 2, 3, 'now', -1, 0, 0, 0, 1, 2, 2, 3, 1, 0, 0, 2, 1, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1, 0, 0];
    const v = grid[selDay];
    const dayNum = selDay - 1;
    const head = dayNum + '. Juli';
    if (v === -1) return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 'var(--radius-block)',
        border: '1.5px dashed var(--warn)',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)'
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink)'
      }
    }, head), " \u2014 Buchungsl\xFCcke: Arbeitstag ohne Buchung."), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary"
    }, "Nachtragen"));
    if (v === 0 || v === null) return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-3)'
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--ink-2)'
      }
    }, head), " \u2014 keine Buchungen (Wochenende/frei).");
    const entries = v === 'now' ? [['Finanzo Review', 'var(--project-1)', '1:30'], ['Nordwind Call', 'var(--project-3)', '0:45'], ['Sync engine', 'var(--project-2)', '2:10']] : [['Finanzo API', 'var(--project-1)', v + ':10'], ['Sync engine', 'var(--project-2)', v === 1 ? '0:50' : v - 1 + ':40']];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        color: 'var(--ink)'
      }
    }, head, v === 'now' ? ' · heute' : ''), entries.map(([n, c, h]) => /*#__PURE__*/React.createElement("span", {
      key: n,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: c,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: '1 1 300px',
        minWidth: 0
      }
    }, n), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, h, "h"))));
  })()), range === 'year' && /*#__PURE__*/React.createElement(Card, {
    title: "Intensit\xE4t",
    subtitle: "Letzte 12 Monate",
    style: {
      flex: '1 1 300px',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Heatmap, {
    weeks: 12
  }))), /*#__PURE__*/React.createElement("div", {
    className: "dt-rise",
    style: {
      marginTop: 12,
      animationDelay: '240ms'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "R\xFCckstau trifft Belastung",
    subtitle: d.label + ' · Netto-Aufgaben vs. Belastungstrend — gleiche Zeitachse'
  }, (() => {
    const wk = d.burn.tasks; // [neu, zu] pro Woche
    const n = wk.length;
    const W = 620,
      H = 150,
      PAD = 30,
      colW = (W - PAD * 2) / n;
    const nets = wk.map(([a, b]) => a - b);
    const maxNet = Math.max(3, ...nets.map(Math.abs));
    const zeroY = 40,
      unit = 26 / maxNet; // Balken-Nulllinie oben
    // Belastungstrend (steigend) — normalisiert auf untere Hälfte
    const strain = {
      week: [52, 58, 61, 64],
      month: [40, 48, 55, 60, 55, 62],
      year: [30, 38, 44, 50, 56, 47]
    }[range] || [50, 55, 60, 64];
    const sN = strain.length;
    const sx = i => PAD + i / (sN - 1) * (W - PAD * 2);
    const sy = v => H - 18 - v / 100 * (H - 70);
    const strainPts = strain.map((v, i) => sx(i) + ',' + sy(v)).join(' ');
    const cross = nets[n - 1] > 0 && strain[sN - 1] >= 60;
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("svg", {
      viewBox: '0 0 ' + W + ' ' + H,
      style: {
        width: '100%',
        display: 'block'
      }
    }, /*#__PURE__*/React.createElement("line", {
      x1: PAD,
      y1: zeroY,
      x2: W - PAD,
      y2: zeroY,
      stroke: "var(--border-strong)",
      strokeWidth: "1"
    }), /*#__PURE__*/React.createElement("text", {
      x: PAD - 4,
      y: zeroY + 3,
      textAnchor: "end",
      fontFamily: "var(--font-mono)",
      fontSize: "8",
      fill: "var(--ink-3)"
    }, "0"), nets.map((net, i) => {
      const h = Math.abs(net) * unit;
      const up = net > 0;
      const cx = PAD + colW * i + colW / 2;
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("rect", {
        className: "dt-grow",
        style: {
          animationDelay: 150 + i * 90 + 'ms',
          transformOrigin: 'center ' + zeroY + 'px'
        },
        x: cx - 9,
        y: up ? zeroY - h : zeroY,
        width: "18",
        height: Math.max(h, 1),
        rx: "3",
        fill: up ? 'var(--warn)' : 'var(--good)',
        opacity: "0.9"
      }), /*#__PURE__*/React.createElement("text", {
        x: cx,
        y: up ? zeroY - h - 4 : zeroY + h + 11,
        textAnchor: "middle",
        fontFamily: "var(--font-mono)",
        fontSize: "9",
        fontWeight: "700",
        fill: up ? 'var(--warn)' : 'var(--good)'
      }, net > 0 ? '+' + net : net), /*#__PURE__*/React.createElement("text", {
        x: cx,
        y: H - 4,
        textAnchor: "middle",
        fontFamily: "var(--font-mono)",
        fontSize: "8",
        fill: "var(--ink-3)"
      }, range === 'week' ? 'T' + (i + 1) : 'W' + (i + 1)));
    }), /*#__PURE__*/React.createElement("text", {
      x: W - PAD,
      y: sy(strain[0]) - 8,
      textAnchor: "end",
      fontFamily: "var(--font-mono)",
      fontSize: "8",
      fill: "var(--warn)"
    }, "Belastung"), /*#__PURE__*/React.createElement("polyline", {
      className: "dt-draw",
      pathLength: "1",
      strokeDasharray: "1",
      style: {
        animationDuration: '1100ms'
      },
      points: strainPts,
      fill: "none",
      stroke: "var(--warn)",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      opacity: "0.85"
    }), strain.map((v, i) => /*#__PURE__*/React.createElement("circle", {
      key: i,
      className: "dt-pop",
      style: {
        animationDelay: 300 + i * 100 + 'ms'
      },
      cx: sx(i),
      cy: sy(v),
      r: i === sN - 1 ? 4 : 2.5,
      fill: i === sN - 1 ? 'var(--warn)' : 'var(--surface)',
      stroke: "var(--warn)",
      strokeWidth: "1.5"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 16,
        marginTop: 8,
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        flexWrap: 'wrap',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 2,
        background: 'var(--warn)'
      }
    }), " R\xFCckstau w\xE4chst (neu > geschlossen)"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 2,
        background: 'var(--good)'
      }
    }), " abgebaut"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 2,
        background: 'var(--warn)'
      }
    }), " Belastungstrend")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 12
      }
    }, /*#__PURE__*/React.createElement(AICallout, {
      compact: true,
      title: cross ? 'Beide Kurven zeigen nach oben.' : 'Rückstau und Belastung entkoppeln sich gerade.',
      action: /*#__PURE__*/React.createElement(Button, {
        size: "sm"
      }, "\u2726 Backlog priorisieren")
    }, cross ? 'Dein Backlog wächst netto (+' + nets[n - 1] + ') und die Belastung steigt parallel — das ist das Muster, das dem Kippen vorausgeht. Vorschlag: diese Woche keine neuen Tasks ziehen, zwei P3 nach KW 29 verschieben.' : 'Du schließt zuletzt mehr, als reinkommt, während die Belastung noch nachhängt — der gesunde Fall. Halte das Tempo, dann fällt der Trend in 1–2 Wochen.')));
  })()))));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/ReportsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/TodayScreen.jsx
try { (() => {
function TodayScreen({
  theme,
  running,
  setRunning,
  paused,
  setPaused,
  secs,
  fmt
}) {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    DayBlock,
    Card,
    Button,
    Badge
  } = DS;
  // Defensive: never blank-screen on a one-compile-stale bundle
  const Icon = DS.Icon || (() => null);
  const AICallout = DS.AICallout || (({
    title,
    children,
    action
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      border: '1px solid var(--accent-border)',
      borderRadius: 'var(--radius-card)',
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink-2)'
    }
  }, title && /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, title, " "), children), action));
  // Punch-out mood: asked once, im Moment des Ausstempelns — kein stehendes Widget
  const [askMood, setAskMood] = React.useState(false);
  const [moodPicked, setMoodPicked] = React.useState(null);

  // ---- Co-Planner state: ghosts are PROPOSALS (dashed, provenance) ----
  const [ghosts, setGhosts] = React.useState([{
    id: 1,
    label: 'Deep work: Sync engine',
    time: '13:00–15:00',
    color: 'var(--project-2)'
  }, {
    id: 2,
    label: 'Code review backlog',
    time: '15:15–16:00',
    color: 'var(--project-4)'
  }]);
  const [accepted, setAccepted] = React.useState([]);
  const [planning, setPlanning] = React.useState(false);
  const [driftEvent, setDriftEvent] = React.useState(true);
  const [task, setTask] = React.useState('Sync engine: conflict resolution');
  const [billable, setBillable] = React.useState(true); // B5
  const [idle, setIdle] = React.useState(true); // B7: mock — Nutzer kam nach 40 min zurück
  const [nl, setNl] = React.useState('');
  const [nlDone, setNlDone] = React.useState(false);

  // One-tap replan: the Co-Planner reflows the rest of the day (deterministic
  // engine proposes; nothing lands without your tap — ADR-0005).
  const replan = () => {
    setPlanning(true);
    setTimeout(() => {
      setGhosts([{
        id: 3,
        label: 'Deep work: Sync engine',
        time: '13:00–14:45',
        color: 'var(--project-2)'
      }, {
        id: 4,
        label: 'Nordwind Call (verschoben)',
        time: '15:00–15:45',
        color: 'var(--project-3)'
      }, {
        id: 5,
        label: 'Code review backlog',
        time: '16:00–16:45',
        color: 'var(--project-4)'
      }]);
      setDriftEvent(false);
      setPlanning(false);
    }, 900);
  };
  const acceptGhost = g => {
    setAccepted(a => [...a, g.id]);
  };
  const dismissGhost = g => {
    setGhosts(gs => gs.filter(x => x.id !== g.id));
  };

  // ---- NL Quick-Add: LIVE deterministic parse (no model, no credit) ----
  const PROJECTS = [['finanzo', 'Finanzo AG', 'var(--project-1)'], ['nordwind', 'Nordwind GmbH', 'var(--project-3)'], ['sync', 'Sync engine', 'var(--project-2)'], ['atlas', 'Atlas Relaunch', 'var(--project-4)']];
  const parsed = React.useMemo(() => {
    if (!nl.trim()) return null;
    const h = nl.match(/(\d+(?:[.,]\d+)?)\s*(?:h|std)/i);
    const m = nl.match(/(\d+)\s*(?:min|m)(?![a-z])/i);
    const proj = PROJECTS.find(p => nl.toLowerCase().includes(p[0]));
    const when = /gestern/i.test(nl) ? 'Gestern' : /morgen/i.test(nl) ? 'Morgen' : 'Heute';
    return {
      dur: h ? h[1].replace('.', ',') + 'h' : m ? m[1] + 'min' : null,
      proj,
      when
    };
  }, [nl]);
  const apps = [{
    name: 'VS Code',
    mins: 96,
    pct: 68
  }, {
    name: 'Chrome — localhost',
    mins: 21,
    pct: 15
  }, {
    name: 'Terminal',
    mins: 14,
    pct: 10
  }, {
    name: 'Figma',
    mins: 10,
    pct: 7
  }];
  const segColors = ['var(--project-2)', 'var(--project-4)', 'var(--project-1)', 'var(--project-3)'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      boxSizing: 'border-box',
      maxWidth: 1080,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '24px 28px 0'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-rec-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } } @keyframes dt-think { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } } @keyframes dt-ghost-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-2xl)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--ink-2)',
      fontSize: 'var(--fs-sm)'
    }
  }, "Tuesday, July 8"), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      display: 'inline-flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--good-soft)',
      color: 'var(--good)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--good)'
    }
  }), "Im Plan \xB7 +6m"), /*#__PURE__*/React.createElement("span", {
    title: "Belastung: erh\xF6ht \u2014 3. Woche \xFCber Soll. Details in Reports \u2192 Balance",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--warn-soft)',
      color: 'var(--warn)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      cursor: 'default'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--warn)'
    }
  }), "Balance: erh\xF6ht"), /*#__PURE__*/React.createElement("span", {
    title: "12 Tage in Folge \u2265 2h Fokus",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--live-soft)',
      color: 'var(--live-strong)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--live)'
    }
  }), "Serie 12"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexWrap: 'nowrap',
      padding: '18px 22px',
      background: 'var(--surface)',
      border: running ? '1px solid var(--live-border)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: running ? '0 12px 36px -14px rgba(255,83,32,0.35)' : 'var(--shadow-md)',
      transition: 'border-color var(--dur-med) var(--ease-out), box-shadow var(--dur-med) var(--ease-out)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: task,
    onChange: e => setTask(e.target.value),
    placeholder: "Woran arbeitest du?",
    style: {
      flex: '1 1 auto',
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-lg)',
      fontWeight: 500,
      color: 'var(--ink)',
      textOverflow: 'ellipsis'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 14px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--surface-sunk)',
      border: '1px solid var(--border)',
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      flexShrink: 1,
      minWidth: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--project-2)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, "Sync engine")), /*#__PURE__*/React.createElement("span", {
    title: "Billable \u2014 Eintrag geht in die Abrechnung (78\u20AC/h)",
    onClick: () => setBillable(b => !b),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 34,
      borderRadius: '50%',
      cursor: 'pointer',
      flexShrink: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15,
      border: billable ? '1.5px solid var(--accent)' : '1.5px solid var(--border-strong)',
      background: billable ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface)',
      color: billable ? 'var(--accent)' : 'var(--ink-3)',
      transition: 'all var(--dur-fast) var(--ease-out)',
      userSelect: 'none'
    }
  }, "\u20AC"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-xl)',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: running ? paused ? 'var(--warn)' : 'var(--live)' : 'var(--ink-3)',
      textAlign: 'right',
      flexShrink: 0,
      transition: 'color var(--dur-med) var(--ease-out)'
    }
  }, fmt(secs)), running && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0
    }
  }, paused && [0, 1].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "dt-pulse",
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: 'var(--warn)',
      animation: 'dt-punch-wave 2s var(--ease-out) infinite',
      animationDelay: i * 1 + 's',
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPaused(!paused),
    "aria-label": paused ? 'Weiter' : 'Pause',
    title: paused ? 'Weiter' : 'Pause',
    className: paused ? 'dt-breathe-warn' : '',
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      cursor: 'pointer',
      flexShrink: 0,
      position: 'relative',
      border: '1.5px solid ' + (paused ? 'var(--warn)' : 'var(--border-strong)'),
      background: paused ? 'var(--warn-soft)' : 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)'
    }
  }, paused ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      height: 0,
      marginLeft: 3,
      borderTop: '8px solid transparent',
      borderBottom: '8px solid transparent',
      borderLeft: '13px solid var(--warn)'
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 16,
      borderRadius: 2,
      background: 'var(--ink-2)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 16,
      borderRadius: 2,
      background: 'var(--ink-2)'
    }
  })))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("style", null, ['@keyframes dt-punch-wave { 0% { transform: scale(0.5); opacity: 0.45; } 100% { transform: scale(1.9); opacity: 0; } }', '@keyframes dt-breathe { 0%, 100% { transform: scale(1); box-shadow: 0 10px 28px -8px rgba(255,83,32,0.55); } 50% { transform: scale(1.06); box-shadow: 0 12px 36px -6px rgba(255,83,32,0.8); } }', '.dt-breathe-live { animation: dt-breathe 2.4s ease-in-out infinite; }', '@keyframes dt-breathe-w { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }', '.dt-breathe-warn { animation: dt-breathe-w 2s ease-in-out infinite; }', '@media (prefers-reduced-motion: reduce) { .dt-pulse, .dt-breathe-live, .dt-breathe-warn { animation: none !important; } .dt-pulse { opacity: 0 !important; } }'].join(' ')), running && !paused && [0, 1].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "dt-pulse",
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: 'var(--live)',
      animation: 'dt-punch-wave 2.4s var(--ease-out) infinite',
      animationDelay: i * 1.2 + 's',
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("button", {
    className: running && !paused ? 'dt-breathe-live' : '',
    onClick: () => {
      if (running) {
        setRunning(false);
        setPaused(false);
        setAskMood(true);
        setMoodPicked(null);
      } else {
        setRunning(true);
        setAskMood(false);
      }
    },
    "aria-label": running ? 'Stop' : 'Start',
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      position: 'relative',
      background: running ? 'var(--live)' : 'var(--accent)',
      boxShadow: running ? '0 10px 28px -8px rgba(255,83,32,0.55)' : '0 10px 28px -8px rgba(54,84,224,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'background var(--dur-med) var(--ease-out), transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-med) var(--ease-out)'
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = 'scale(0.92)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)';
    }
  }, running ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 5,
      background: '#fff'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      height: 0,
      marginLeft: 5,
      borderTop: '13px solid transparent',
      borderBottom: '13px solid transparent',
      borderLeft: '22px solid #fff'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      margin: '0 -28px',
      padding: '4px 28px 28px'
    }
  }, idle && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 12,
      padding: '12px 16px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--warn-soft)',
      border: '1px solid color-mix(in srgb, var(--warn) 35%, transparent)',
      animation: 'dt-ghost-in var(--dur-med) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--warn)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-xs)',
      color: 'var(--ink)',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("b", null, "40 min inaktiv"), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-2)'
    }
  }, "(12:20\u201313:00) \u2014 Timer lief weiter. Was soll damit passieren?")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIdle(false);
      window.dtToast && window.dtToast('40 min behalten — auf Sync engine gebucht', () => setIdle(true));
    },
    style: {
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      borderRadius: 999,
      padding: '5px 12px',
      cursor: 'pointer'
    }
  }, "Behalten"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIdle(false);
      window.dtToast && window.dtToast('40 min als Pause markiert', () => setIdle(true));
    },
    style: {
      border: '1px solid var(--border-strong)',
      background: 'var(--surface)',
      color: 'var(--ink)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      borderRadius: 999,
      padding: '5px 12px',
      cursor: 'pointer'
    }
  }, "Als Pause"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setIdle(false);
      window.dtToast && window.dtToast('40 min verworfen — Timer um 12:20 gekürzt', () => setIdle(true));
    },
    style: {
      border: 'none',
      background: 'var(--warn)',
      color: '#fff',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      borderRadius: 999,
      padding: '6px 12px',
      cursor: 'pointer'
    }
  }, "Verwerfen"))), askMood && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      marginBottom: 12,
      padding: '10px 16px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-sm)'
    }
  }, moodPicked ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--good)'
    }
  }, "Notiert \u2014 flie\xDFt still in deinen Balance-Trend ein.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      whiteSpace: 'nowrap'
    }
  }, "Ausgestempelt \xB7 wie war der Block?"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      gap: 16
    }
  }, [['gut', 'Gut', 'var(--good)'], ['angespannt', 'Angespannt', 'var(--warn)'], ['gestresst', 'Gestresst', 'var(--bad)']].map(([id, label, color]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => {
      setMoodPicked(id);
      setTimeout(() => {
        setAskMood(false);
        setMoodPicked(null);
      }, 2000);
    },
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink-2)',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color
    }
  }), label))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAskMood(false),
    "aria-label": "\xDCberspringen",
    style: {
      marginLeft: 'auto',
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontSize: 'var(--fs-2xs)'
    }
  }, "\xDCberspringen"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: nl && parsed ? 'var(--radius-card) var(--radius-card) 0 0' : 'var(--radius-pill)',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ink-3)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    value: nl,
    onChange: e => {
      setNl(e.target.value);
      setNlDone(false);
    },
    placeholder: 'Schnell eintragen: „2h finanzo review gestern"',
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }), /*#__PURE__*/React.createElement("kbd", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      color: 'var(--ink-3)',
      border: '1px solid var(--border)',
      borderRadius: 5,
      padding: '2px 6px',
      background: 'var(--surface-sunk)'
    }
  }, "\u2318K")), nl && parsed && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderTop: 'none',
      borderRadius: '0 0 var(--radius-card) var(--radius-card)',
      animation: 'dt-ghost-in var(--dur-med) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "Erkannt"), parsed.dur && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      background: 'var(--surface-sunk)',
      padding: '3px 10px',
      borderRadius: 'var(--radius-pill)'
    }
  }, parsed.dur), parsed.proj && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      background: 'var(--surface-sunk)',
      padding: '3px 10px',
      borderRadius: 'var(--radius-pill)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: parsed.proj[2]
    }
  }), parsed.proj[1]), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      background: 'var(--surface-sunk)',
      padding: '3px 10px',
      borderRadius: 'var(--radius-pill)'
    }
  }, parsed.when), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 10,
      color: 'var(--ink-3)'
    }
  }, "deterministisch geparst \xB7 kein Credit"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => {
      setNlDone(true);
      setNl('');
    }
  }, "Eintragen")), nlDone && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--good)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), " Eintrag angelegt \u2014 erscheint im Day Canvas.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Co-Planner",
    subtitle: "Morgen-Briefing \xB7 08:12",
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        gap: 8,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "accent"
    }, "\u2726 Vorschlag"), ghosts.some(g => !accepted.includes(g.id)) && /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => setAccepted(ghosts.map(g => g.id))
    }, "Alle \xFCbernehmen"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(AICallout, {
    compact: true,
    title: "Dein Tag: 3 Meetings, 4,5h Fokus m\xF6glich."
  }, "Nordwind ist bei 91% Budget \u2014 Deep Work auf Sync engine priorisiert, Reviews in den Nachmittag. Vorschlag unten: annehmen, ziehen oder verwerfen.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      opacity: planning ? 0.5 : 1,
      transition: 'opacity var(--dur-med) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement(DayBlock, {
    label: "Team standup",
    time: "09:00\u201309:15",
    kind: "meeting",
    color: "var(--project-1)",
    height: 48
  }), /*#__PURE__*/React.createElement(DayBlock, {
    label: "Finanzo Review",
    time: "09:30\u201311:00",
    kind: "actual",
    color: "var(--project-1)",
    height: 56
  }), /*#__PURE__*/React.createElement(DayBlock, {
    label: "Client call \u2014 Nordwind",
    time: "11:15\u201312:00",
    kind: "meeting",
    color: "var(--project-3)",
    height: 48
  }), ghosts.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.id,
    style: {
      animation: 'dt-ghost-in var(--dur-slow) var(--ease-spring)'
    }
  }, /*#__PURE__*/React.createElement(DayBlock, {
    label: g.label,
    time: g.time,
    kind: accepted.includes(g.id) ? 'actual' : 'ghost',
    color: g.color,
    onAccept: () => acceptGhost(g),
    onDismiss: () => dismissGhost(g)
  })))), planning && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--accent-strong)',
      fontWeight: 600,
      animation: 'dt-think 1s ease infinite'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "assistant",
    size: 14
  }), " Co-Planner ordnet den Rest des Tages neu \u2026"), !planning && accepted.length > 0 && accepted.length === ghosts.length && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--good)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 14
  }), " Plan \xFCbernommen \u2014 ", ghosts.length, " Bl\xF6cke sind jetzt fest.")), driftEvent && /*#__PURE__*/React.createElement(AICallout, {
    title: "Nordwind Call auf 15:00 verschoben.",
    action: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: replan
    }, "\u2726 Neu planen"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost",
      onClick: () => setDriftEvent(false)
    }, "Ignorieren"))
  }, "Rest des Tages neu planen?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Auto-Tracker",
    subtitle: running && !paused ? 'zeichnet auf' : 'pausiert',
    action: running && !paused && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        color: 'var(--live)',
        letterSpacing: 'var(--ls-wide)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--live)',
        animation: 'dt-rec-pulse 1.6s ease infinite'
      }
    }), "REC")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: 10,
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      gap: 2,
      marginBottom: 14
    }
  }, apps.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: a.name,
    style: {
      width: a.pct + '%',
      background: segColors[i]
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, apps.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: a.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: 7,
      background: 'var(--ink)',
      color: 'var(--surface)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 700,
      fontFamily: 'var(--font-display)',
      flexShrink: 0
    }
  }, a.name[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 4,
      borderRadius: 2,
      background: 'var(--surface-sunk)',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: a.pct + '%',
      height: '100%',
      borderRadius: 2,
      background: segColors[i],
      transition: 'width var(--dur-slow) var(--ease-out)'
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, Math.floor(a.mins / 60) > 0 ? Math.floor(a.mins / 60) + 'h ' : '', a.mins % 60, "m")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      paddingTop: 12,
      borderTop: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement(AICallout, {
    compact: true
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, "68% im Editor"), " \u2014 die Session sieht nach reiner Umsetzung aus. Als \u201ESync engine: Implementierung\u201C buchen? ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--ai-ink)',
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "\xDCbernehmen"))))))));
}
window.TodayScreen = TodayScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/TodayScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/app.jsx
try { (() => {
function DevTimeApp() {
  const {
    AppShell,
    Island
  } = window.MyDevTimeDesignSystem_254296;
  const [screen, setScreen] = React.useState('today');
  const [theme, setTheme] = React.useState('blueprint');
  const [mode, setMode] = React.useState('light');

  // Shared live-timer state — ONE clock for the whole app: the Today hero
  // owns it on Today; the Island carries it on every other screen.
  const [running, setRunning] = React.useState(true);
  const [paused, setPaused] = React.useState(false);

  // C10: globaler Undo-Toast — Screens rufen window.dtToast(msg, onUndo)
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  React.useEffect(() => {
    window.dtToast = (msg, onUndo) => {
      clearTimeout(toastTimer.current);
      setToast({
        msg,
        onUndo
      });
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    };
    return () => {
      delete window.dtToast;
      clearTimeout(toastTimer.current);
    };
  }, []);
  const [secs, setSecs] = React.useState(2531);
  const [islandExpanded, setIslandExpanded] = React.useState(false);
  const [punched, setPunched] = React.useState(true);
  const punchOut = () => {
    setPunched(false);
    setRunning(false);
    setPaused(false);
  };
  const punchIn = () => {
    setPunched(true);
  };
  React.useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);
  const fmt = s => [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');
  const screens = {
    today: window.TodayScreen,
    planner: window.PlannerScreen,
    absence: window.AbsenceScreen,
    projects: window.ProjectsScreen,
    reports: window.ReportsScreen,
    meetings: window.MeetingsScreen,
    assistant: window.AssistantScreen,
    profile: window.ProfileScreen
  };
  const Screen = screens[screen] || window.TodayScreen;
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": theme,
    "data-mode": mode,
    style: {
      height: '100vh',
      background: 'var(--bg)'
    }
  }, /*#__PURE__*/React.createElement(AppShell, {
    posture: "sidebar",
    active: screen,
    onNavigate: setScreen,
    island: screen !== 'today' &&
    /*#__PURE__*/
    /* Docked in the sidebar footer — always visible, never covering
       the working surface. Hidden on Today, where the hero tracker
       carries the clock: never two clocks at once. */
    React.createElement(Island, {
      posture: "docked",
      running: running,
      elapsed: fmt(secs),
      punched: punched,
      expanded: islandExpanded,
      onToggle: () => setIslandExpanded(!islandExpanded),
      actions: punched ? [running ? {
        label: paused ? 'Weiter' : 'Pause',
        onClick: () => setPaused(!paused)
      } : {
        label: 'Start',
        onClick: () => setRunning(true)
      }, ...(running ? [{
        label: 'Stop',
        onClick: () => {
          setRunning(false);
          setPaused(false);
        }
      }] : []), /* Punch out right here — no forced trip to Today */
      {
        label: 'Ausstempeln',
        onClick: punchOut
      }] : [{
        label: 'Einstempeln',
        onClick: punchIn
      }, {
        label: 'Zu Today',
        onClick: () => setScreen('today')
      }]
    })
  }, Object.entries(screens).map(([id, S]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: screen === id ? 'block' : 'none',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement(S, {
    theme: theme,
    setTheme: setTheme,
    mode: mode,
    setMode: setMode,
    running: running,
    setRunning: setRunning,
    paused: paused,
    setPaused: setPaused,
    secs: secs,
    fmt: fmt
  })))), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: '50%',
      bottom: 24,
      transform: 'translateX(-50%)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      background: 'var(--ink)',
      color: 'var(--bg)',
      borderRadius: 12,
      padding: '11px 16px',
      boxShadow: '0 12px 32px rgba(0,0,0,.28)',
      maxWidth: 560,
      animation: 'dt-toast-in var(--dur-med, .25s) var(--ease-out, ease-out)'
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dt-toast-in { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      lineHeight: 1.4
    }
  }, toast.msg), toast.onUndo && /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      toast.onUndo();
      setToast(null);
    },
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--accent)',
      fontWeight: 700,
      fontSize: 13,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      padding: 0
    }
  }, "R\xFCckg\xE4ngig"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setToast(null),
    "aria-label": "Schlie\xDFen",
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--bg)',
      opacity: 0.6,
      cursor: 'pointer',
      fontSize: 15,
      padding: 0,
      lineHeight: 1
    }
  }, "\xD7")));
}
const __dtRootEl = document.getElementById('root');
__dtRootEl.__reactRoot = __dtRootEl.__reactRoot || ReactDOM.createRoot(__dtRootEl);
__dtRootEl.__reactRoot.render(/*#__PURE__*/React.createElement(DevTimeApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/app.jsx", error: String((e && e.message) || e) }); }

// ui_kits/devtime/phone.jsx
try { (() => {
function PhoneApp() {
  const DS = window.MyDevTimeDesignSystem_254296;
  const {
    AppShell,
    Island,
    Card,
    Badge,
    BudgetRing,
    StatTile
  } = DS;
  const LoadMeter = DS.LoadMeter || (() => null);
  const LeaveBalance = DS.LeaveBalance || (() => null);
  const [tab, setTab] = React.useState('today');
  const [theme, setTheme] = React.useState('blueprint');
  const [mode, setMode] = React.useState('light');
  const [running, setRunning] = React.useState(true);
  const [paused, setPaused] = React.useState(false);
  // Punch-out mood: nur im Moment des Ausstempelns, kein stehendes Widget
  const [askMood, setAskMood] = React.useState(false);
  const [moodPicked, setMoodPicked] = React.useState(null);
  const [secs, setSecs] = React.useState(2531);
  const [expanded, setExpanded] = React.useState(false);
  const [ghostAccepted, setGhostAccepted] = React.useState(false);
  const [entriesOpen, setEntriesOpen] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [absenceOpen, setAbsenceOpen] = React.useState(false);
  const [driftEvent, setDriftEvent] = React.useState(true);
  const [replanned, setReplanned] = React.useState(false);
  const [planning, setPlanning] = React.useState(false);
  const replan = () => {
    setPlanning(true);
    setTimeout(() => {
      setReplanned(true);
      setDriftEvent(false);
      setPlanning(false);
    }, 900);
  };
  React.useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);
  const fmt = s => [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':');

  // ---- Day Canvas geometry (08–18) ----
  const HOUR_H = 40,
    START = 8,
    END = 18;
  const NOW = 14.33;
  const canvasBlocks = [{
    s: 9,
    d: 0.25,
    l: 'Standup',
    c: 'var(--project-1)',
    k: 'meeting'
  }, {
    s: 9.5,
    d: 1.5,
    l: 'Finanzo Review',
    c: 'var(--project-1)',
    k: 'actual'
  }, replanned ? {
    s: 15,
    d: 0.75,
    l: 'Nordwind Call (verschoben)',
    c: 'var(--project-3)',
    k: 'ghost2'
  } : {
    s: 11.25,
    d: 0.75,
    l: 'Nordwind Call',
    c: 'var(--project-3)',
    k: 'meeting'
  }, {
    s: 12,
    d: 0.5,
    l: 'Pause',
    c: 'var(--ink-3)',
    k: 'break'
  }, {
    s: 12.5,
    d: 1.83,
    l: 'Sync engine: conflict resolution',
    c: 'var(--project-2)',
    k: 'live'
  }, replanned ? {
    s: 16,
    d: 0.75,
    l: 'Review backlog',
    c: 'var(--project-4)',
    k: 'ghost'
  } : {
    s: 15.25,
    d: 0.75,
    l: 'Review backlog',
    c: 'var(--project-4)',
    k: 'ghost'
  }];
  const fmtT = h => String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round(h % 1 * 60)).padStart(2, '0');
  const blockStyle = b => {
    const tiny = b.d < 0.5;
    const base = {
      position: 'absolute',
      left: 6,
      right: 6,
      top: (b.s - START) * HOUR_H + 1,
      height: b.d * HOUR_H - 3,
      borderRadius: tiny ? 5 : 'var(--radius-block)',
      padding: tiny ? 0 : '5px 9px',
      overflow: 'hidden',
      boxSizing: 'border-box',
      fontSize: 'var(--fs-2xs)',
      lineHeight: 1.25
    };
    if (b.k === 'break') return {
      ...base,
      background: 'repeating-linear-gradient(135deg, var(--surface-sunk) 0 5px, transparent 5px 10px)',
      border: '1px dashed var(--border-strong)',
      color: 'var(--ink-3)'
    };
    if (b.k === 'ghost2') return {
      ...base,
      border: '1.5px dashed ' + b.c,
      color: 'var(--ink-2)',
      background: 'var(--surface)',
      animation: 'dtp-ghost-in 0.5s var(--ease-spring)'
    };
    if (b.k === 'ghost') return {
      ...base,
      border: '1.5px dashed ' + b.c,
      color: 'var(--ink-2)',
      background: 'var(--surface)'
    };
    if (b.k === 'meeting') return {
      ...base,
      background: b.c,
      color: '#fff'
    };
    if (b.k === 'live') return {
      ...base,
      background: 'color-mix(in srgb, ' + b.c + ' 16%, var(--surface))',
      border: '1.5px solid var(--live-border)',
      color: 'var(--ink)',
      boxShadow: '0 4px 16px -6px rgba(255,83,32,0.35)'
    };
    return {
      ...base,
      background: 'color-mix(in srgb, ' + b.c + ' 14%, var(--surface))',
      borderLeft: '3px solid ' + b.c,
      color: 'var(--ink)'
    };
  };
  const today = /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      paddingBottom: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("style", null, '@keyframes dtp-ghost-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } } @keyframes dtp-think { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--ink-2)',
      fontSize: 'var(--fs-2xs)'
    }
  }, "Di, 8. Juli")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--good-soft)',
      color: 'var(--good)',
      fontSize: 10,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--good)'
    }
  }), " +6m"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 10px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--live-soft)',
      color: 'var(--live-strong)',
      fontSize: 10,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--live)'
    }
  }), " 12")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-xl)',
      border: running ? '1px solid var(--live-border)' : '1px solid var(--border)',
      boxShadow: running ? '0 10px 30px -12px rgba(255,83,32,0.4)' : 'var(--shadow-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, "Sync engine: conflict resolution"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: 'var(--project-2)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--ink-2)',
      fontWeight: 600
    }
  }, "Sync engine"))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 20,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      color: running ? paused ? 'var(--warn)' : 'var(--live)' : 'var(--ink-3)'
    }
  }, fmt(secs)), running && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0
    }
  }, paused && [0, 1].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "dt-pulse",
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: 'var(--warn)',
      animation: 'dt-punch-wave 2s var(--ease-out) infinite',
      animationDelay: i * 1 + 's',
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setPaused(!paused),
    "aria-label": paused ? 'Weiter' : 'Pause',
    className: paused ? 'dt-breathe-warn' : '',
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      cursor: 'pointer',
      flexShrink: 0,
      position: 'relative',
      border: '1.5px solid ' + (paused ? 'var(--warn)' : 'var(--border-strong)'),
      background: paused ? 'var(--warn-soft)' : 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3
    }
  }, paused ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      height: 0,
      marginLeft: 2,
      borderTop: '6px solid transparent',
      borderBottom: '6px solid transparent',
      borderLeft: '10px solid var(--warn)'
    }
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 13,
      borderRadius: 2,
      background: 'var(--ink-2)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 13,
      borderRadius: 2,
      background: 'var(--ink-2)'
    }
  })))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("style", null, ['@keyframes dt-punch-wave { 0% { transform: scale(0.5); opacity: 0.45; } 100% { transform: scale(1.9); opacity: 0; } }', '@keyframes dt-breathe { 0%, 100% { transform: scale(1); box-shadow: 0 8px 20px -6px rgba(255,83,32,0.55); } 50% { transform: scale(1.06); box-shadow: 0 10px 28px -4px rgba(255,83,32,0.8); } }', '.dt-breathe-live { animation: dt-breathe 2.4s ease-in-out infinite; }', '@keyframes dt-breathe-w { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }', '.dt-breathe-warn { animation: dt-breathe-w 2s ease-in-out infinite; }', '@media (prefers-reduced-motion: reduce) { .dt-pulse, .dt-breathe-live, .dt-breathe-warn { animation: none !important; } .dt-pulse { opacity: 0 !important; } }'].join(' ')), running && !paused && [0, 1].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "dt-pulse",
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: '50%',
      background: 'var(--live)',
      animation: 'dt-punch-wave 2.4s var(--ease-out) infinite',
      animationDelay: i * 1.2 + 's',
      pointerEvents: 'none'
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (running) {
        setRunning(false);
        setPaused(false);
        setAskMood(true);
        setMoodPicked(null);
      } else {
        setRunning(true);
        setAskMood(false);
      }
    },
    "aria-label": running ? 'Stop' : 'Start',
    className: running && !paused ? 'dt-breathe-live' : '',
    style: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      flexShrink: 0,
      position: 'relative',
      background: running ? 'var(--live)' : 'var(--accent)',
      boxShadow: running ? '0 8px 20px -6px rgba(255,83,32,0.55)' : '0 8px 20px -6px rgba(37,99,235,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, running ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      borderRadius: 4,
      background: '#fff'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 0,
      height: 0,
      marginLeft: 4,
      borderTop: '10px solid transparent',
      borderBottom: '10px solid transparent',
      borderLeft: '17px solid #fff'
    }
  })))), askMood && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      flexWrap: 'wrap'
    }
  }, moodPicked ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--good)'
    }
  }, "Notiert \u2014 flie\xDFt in Balance ein.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, "Wie war der Block?"), [['gut', 'Gut', 'var(--good)'], ['angespannt', 'Angespannt', 'var(--warn)'], ['gestresst', 'Gestresst', 'var(--bad)']].map(([id, label, color]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => {
      setMoodPicked(id);
      setTimeout(() => {
        setAskMood(false);
        setMoodPicked(null);
      }, 2000);
    },
    style: {
      border: 'none',
      background: 'none',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--ink-2)',
      padding: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color
    }
  }), label)))), driftEvent && /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 7,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      flexShrink: 0
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, "Nordwind Call \u2192 15:00."), " Tag neu planen?"), /*#__PURE__*/React.createElement("button", {
    onClick: replan,
    style: {
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '6px 12px',
      fontSize: 11,
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, "Neu planen"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDriftEvent(false),
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--ink-3)',
      fontSize: 14,
      cursor: 'pointer',
      padding: 4,
      flexShrink: 0
    }
  }, "\u2715"))), planning && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--accent-strong)',
      fontWeight: 600,
      animation: 'dtp-think 1s ease infinite'
    }
  }, "\u2726 Co-Planner ordnet den Rest des Tages neu \u2026"), replanned && !planning && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--good)',
      fontWeight: 600
    }
  }, "\u2713 Neu geplant \u2014 Call auf 15:00, Reviews auf 16:00 verschoben."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--warn)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, "\u26A0 Ohne Platz"), [['Vendor Call', '45m', 'var(--project-3)'], ['Review backlog', '1:30h', 'var(--project-4)'], ['Tech Spec', '1:05h', 'var(--project-2)']].map(([l, t, c]) => /*#__PURE__*/React.createElement("span", {
    key: l,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 11px',
      borderRadius: 'var(--radius-pill)',
      border: '1.5px dashed var(--warn)',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      whiteSpace: 'nowrap',
      flexShrink: 0,
      background: 'var(--surface)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: c
    }
  }), l, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, t)))), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      padding: '12px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 44,
      height: (END - START) * HOUR_H,
      flexShrink: 0
    }
  }, Array.from({
    length: END - START - 1
  }, (_, i) => START + 1 + i).map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      position: 'absolute',
      top: (h - START) * HOUR_H - 6,
      right: 6,
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: 'var(--ink-3)',
      fontVariantNumeric: 'tabular-nums'
    }
  }, String(h).padStart(2, '0'), ":00"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      height: (END - START) * HOUR_H,
      marginRight: 10
    }
  }, Array.from({
    length: END - START - 1
  }, (_, i) => START + 1 + i).map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      position: 'absolute',
      top: (h - START) * HOUR_H,
      left: 0,
      right: 0,
      borderTop: '1px solid var(--border)',
      opacity: 0.55
    }
  })), canvasBlocks.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: blockStyle(b),
    title: b.l + ' · ' + fmtT(b.s) + '–' + fmtT(b.s + b.d)
  }, b.d >= 0.7 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, b.k === 'live' && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--live)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, b.l)), b.d >= 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      opacity: 0.75,
      fontVariantNumeric: 'tabular-nums'
    }
  }, fmtT(b.s), "\u2013", fmtT(b.s + b.d)), b.k === 'ghost' && !ghostAccepted && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 6,
      top: 5,
      display: 'flex',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setGhostAccepted(true),
    style: {
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '2px 9px',
      fontSize: 9,
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer'
    }
  }, "\u2713"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setGhostAccepted(true),
    style: {
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-pill)',
      padding: '2px 9px',
      fontSize: 9,
      fontWeight: 700,
      background: 'var(--surface)',
      color: 'var(--ink-2)',
      cursor: 'pointer'
    }
  }, "\u2715")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: (NOW - START) * HOUR_H,
      left: -4,
      right: 0,
      zIndex: 4,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      background: 'var(--live)',
      boxShadow: '0 0 8px rgba(255,83,32,0.6)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -2,
      top: -4,
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--live)'
    }
  }))))), (() => {
    const entries = [['ADR schreiben', '1:30', 'var(--project-2)', 21], ['Auth Bug', '1:10', 'var(--project-4)', 16], ['Roadmap Workshop', '1:00', 'var(--project-1)', 14], ['PR Reviews', '0:55', 'var(--project-5)', 13], ['Merge Konflikte', '0:50', 'var(--project-6)', 11], ['Incident Bridge', '0:45', 'var(--project-3)', 10], ['Nordwind Call', '0:40', 'var(--project-3)', 6], ['Finanzo Sync', '0:35', 'var(--project-1)', 4], ['Design Review', '0:30', 'var(--project-7)', 3], ['Standup', '0:30', 'var(--project-1)', 2]];
    const shown = entriesOpen ? entries : entries.slice(0, 3);
    return /*#__PURE__*/React.createElement(Card, {
      padding: false
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 'var(--fs-sm)',
        color: 'var(--ink)'
      }
    }, "Eintr\xE4ge heute"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--ink-3)',
        background: 'var(--surface-sunk)',
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px'
      }
    }, entries.length), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        color: 'var(--ink)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, "8:25h")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: 10,
        borderRadius: 'var(--radius-pill)',
        overflow: 'hidden',
        gap: 2,
        marginBottom: 12
      }
    }, entries.map(([l,, c, pct]) => /*#__PURE__*/React.createElement("span", {
      key: l,
      style: {
        width: pct + '%',
        background: c
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, shown.map(([l, t, c]) => /*#__PURE__*/React.createElement("div", {
      key: l,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: c,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        color: 'var(--ink)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, l), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, t))))), /*#__PURE__*/React.createElement("button", {
      onClick: () => setEntriesOpen(!entriesOpen),
      style: {
        width: '100%',
        border: 'none',
        borderTop: '1px solid var(--border)',
        background: 'none',
        padding: '10px 16px',
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        color: 'var(--accent-strong)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)'
      }
    }, entriesOpen ? 'Weniger anzeigen' : '+' + (entries.length - 3) + ' weitere anzeigen'));
  })());
  const planner = /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      paddingBottom: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Planner ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      fontWeight: 400
    }
  }, "KW 28")), [{
    d: 'Mo',
    total: '7,2h',
    segs: [['var(--project-1)', 38], ['var(--project-2)', 28], ['var(--project-4)', 20]]
  }, {
    d: 'Di',
    total: '5,4h',
    today: true,
    segs: [['var(--project-1)', 25], ['var(--project-3)', 12], ['var(--project-2)', 30]]
  }, {
    d: 'Mi',
    total: '6,5h',
    segs: [['var(--project-3)', 30], ['var(--project-2)', 45]]
  }, {
    d: 'Do',
    total: '7,0h',
    segs: [['var(--project-1)', 45], ['var(--project-3)', 14], ['var(--project-2)', 28]]
  }, {
    d: 'Fr',
    total: 'Urlaub',
    segs: []
  }].map(row => /*#__PURE__*/React.createElement("div", {
    key: row.d,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      background: row.today ? 'var(--accent-soft)' : 'var(--surface)',
      border: '1px solid ' + (row.today ? 'var(--accent-border)' : 'var(--border)'),
      borderRadius: 'var(--radius-card)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-sm)',
      color: row.today ? 'var(--accent-strong)' : 'var(--ink)',
      width: 26
    }
  }, row.d), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      height: 12,
      borderRadius: 'var(--radius-pill)',
      overflow: 'hidden',
      gap: 2,
      background: 'var(--surface-sunk)'
    }
  }, row.segs.map(([c, w], i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: w + '%',
      background: c
    }
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)',
      fontVariantNumeric: 'tabular-nums',
      width: 44,
      textAlign: 'right'
    }
  }, row.total))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-3)'
    }
  }, "Volles Wochen-Gantt mit Drag & Drop \u2192 Tablet/Desktop."));
  const projects = (() => {
    // Bounded: sortiert nach Budget-Risiko, Top 3 sichtbar, Rest per Drill-in.
    const all = [{
      n: 'Nordwind GmbH',
      c: 'var(--project-3)',
      pct: 91,
      h: '72,8h'
    }, {
      n: 'Finanzo AG',
      c: 'var(--project-1)',
      pct: 62,
      h: '96,5h'
    }, {
      n: 'Sync engine',
      c: 'var(--project-2)',
      pct: 34,
      h: '41,2h'
    }, {
      n: 'Atlas Relaunch',
      c: 'var(--project-4)',
      pct: 18,
      h: '14,5h'
    }, {
      n: 'Huber CMS',
      c: 'var(--project-5)',
      pct: 11,
      h: '6,0h'
    }];
    const shown = projectsOpen ? all : all.slice(0, 3);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 16,
        paddingBottom: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 'var(--fs-lg)',
        letterSpacing: 'var(--ls-tight)',
        color: 'var(--ink)'
      }
    }, "Projects"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--ink-3)',
        background: 'var(--surface-sunk)',
        borderRadius: 'var(--radius-pill)',
        padding: '2px 8px'
      }
    }, all.length), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: 'auto',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--ink-3)'
      }
    }, "nach Budget-Risiko")), shown.map(p => /*#__PURE__*/React.createElement(Card, {
      key: p.n
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 38,
        height: 38,
        borderRadius: 11,
        background: 'color-mix(in srgb, ' + p.c + ' 16%, var(--surface))',
        color: p.c,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 13
      }
    }, p.n.split(' ').map(w => w[0]).slice(0, 2).join('')), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: 'var(--fs-sm)',
        color: 'var(--ink)'
      }
    }, p.n), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-2xs)',
        color: 'var(--ink-2)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, p.h)), /*#__PURE__*/React.createElement(BudgetRing, {
      percent: p.pct,
      color: p.c,
      size: 48
    }), p.pct >= 80 && /*#__PURE__*/React.createElement(Badge, {
      tone: "warn"
    }, "!")))), /*#__PURE__*/React.createElement("button", {
      onClick: () => setProjectsOpen(!projectsOpen),
      style: {
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--surface)',
        padding: '9px 16px',
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        color: 'var(--accent-strong)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        alignSelf: 'center'
      }
    }, projectsOpen ? 'Weniger anzeigen' : '+' + (all.length - 3) + ' weitere anzeigen'));
  })();
  const reports = /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      paddingBottom: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Reports"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Billable",
    value: "128.5h",
    delta: 12
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Meetings",
    value: "14",
    delta: 3
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Budget burn-down",
    subtitle: "Nordwind \xB7 ersch\xF6pft ~21.7."
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 300 90",
    style: {
      width: '100%',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: "82",
    x2: "300",
    y2: "82",
    stroke: "var(--border)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "0,8 30,13 60,23 90,28 120,43 150,55",
    fill: "none",
    stroke: "var(--project-3)",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "150,55 210,70 258,82",
    fill: "none",
    stroke: "var(--project-3)",
    strokeWidth: "2",
    strokeDasharray: "5 5",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "150",
    cy: "55",
    r: "4",
    fill: "var(--live)"
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Balance",
    subtitle: "Diese Woche \xB7 keine Diagnose"
  }, /*#__PURE__*/React.createElement(LoadMeter, {
    score: 64,
    width: 280
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      marginTop: 12
    }
  }, [['warn', '3. Woche über Soll'], ['warn', '2× Pause übersprungen'], ['good', 'Keine Abend-Sessions']].map(([tone, label]) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: tone === 'warn' ? 'var(--warn)' : 'var(--good)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink)',
      fontWeight: 600
    }
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      padding: '9px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      flexShrink: 0
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "Belastung steigt."), " Do meetingfrei + Feierabend 17:30?"), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '5px 11px',
      fontSize: 10,
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, "\xDCbernehmen")))));
  const profile = /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      paddingBottom: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-lg)',
      letterSpacing: 'var(--ls-tight)',
      color: 'var(--ink)'
    }
  }, "Profile"), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 14,
      background: 'linear-gradient(135deg, #3D5CF5, #2941B8)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 15
    }
  }, "SS"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, "Suhay Sevinc"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, "Soll 8:20h/Tag \xB7 Saldo ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--good)',
      fontFamily: 'var(--font-mono)'
    }
  }, "+9:30h"))), /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "Pro"))), /*#__PURE__*/React.createElement(Card, {
    padding: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'var(--fs-sm)',
      color: 'var(--ink)'
    }
  }, "Abwesenheit"), /*#__PURE__*/React.createElement("button", {
    style: {
      marginLeft: 'auto',
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '6px 12px',
      fontSize: 10,
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer'
    }
  }, "Antrag stellen")), /*#__PURE__*/React.createElement(LeaveBalance, {
    entitlement: 30,
    taken: 11,
    planned: 5,
    carryover: 2
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "Gleitzeit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      color: 'var(--good)',
      fontVariantNumeric: 'tabular-nums',
      marginTop: 2
    }
  }, "+12:40")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "Krank"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--fs-sm)',
      fontWeight: 600,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums',
      marginTop: 2
    }
  }, "3 Tage")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1.4,
      padding: '9px 12px',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-sunk)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--ink-3)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--ls-wide)'
    }
  }, "N\xE4chster Feiertag"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-2xs)',
      fontWeight: 600,
      color: 'var(--ink)',
      marginTop: 3
    }
  }, "Sa 3.10. Dt. Einheit"))), absenceOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--fs-xs)',
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, "Urlaub \xB7 10.\u201314. Aug"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: 'var(--ink-3)',
      fontFamily: 'var(--font-mono)',
      marginTop: 2
    }
  }, "5 Tage")), /*#__PURE__*/React.createElement(Badge, {
    tone: "good"
  }, "Genehmigt")), /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'var(--radius-card)',
      padding: 1.5,
      background: 'var(--ai-grad)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 'calc(var(--radius-card) - 1.5px)',
      background: 'var(--surface)',
      padding: '9px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 6,
      background: 'var(--ai-grad)',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      flexShrink: 0
    }
  }, "\u2726"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 'var(--fs-2xs)',
      color: 'var(--ink-2)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "Br\xFCckentag:"), " Fr 15.5. \u2192 4 freie Tage f\xFCr 1 Urlaubstag."), /*#__PURE__*/React.createElement("button", {
    style: {
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      padding: '5px 11px',
      fontSize: 10,
      fontWeight: 700,
      background: 'var(--accent)',
      color: '#fff',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, "Anfragen"))))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setAbsenceOpen(!absenceOpen),
    style: {
      width: '100%',
      border: 'none',
      borderTop: '1px solid var(--border)',
      background: 'none',
      padding: '10px 16px',
      fontSize: 'var(--fs-2xs)',
      fontWeight: 700,
      color: 'var(--accent-strong)',
      cursor: 'pointer',
      fontFamily: 'var(--font-ui)'
    }
  }, absenceOpen ? 'Weniger anzeigen' : 'Anträge & Feiertage anzeigen')), /*#__PURE__*/React.createElement(Card, {
    title: "Darstellung"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 10
    }
  }, ['blueprint', 'sovereign', 'ember'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTheme(t),
    style: {
      flex: 1,
      padding: '8px 4px',
      borderRadius: 'var(--radius-block)',
      cursor: 'pointer',
      border: '1.5px solid ' + (theme === t ? 'var(--accent)' : 'var(--border)'),
      background: theme === t ? 'var(--accent-soft)' : 'var(--surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: t === 'blueprint' ? 'var(--blueprint-500)' : t === 'sovereign' ? 'var(--sovereign-500)' : 'var(--ember-500)'
    }
  }), t === 'blueprint' ? 'Königsblau' : t === 'sovereign' ? 'Sovereign' : 'Ember'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, [['light', 'Hell'], ['dark', 'Dunkel']].map(([m, label]) => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => setMode(m),
    style: {
      flex: 1,
      padding: '8px 4px',
      borderRadius: 'var(--radius-block)',
      cursor: 'pointer',
      border: '1.5px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
      background: mode === m ? 'var(--accent-soft)' : 'var(--surface)',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--ink)'
    }
  }, label)))));
  const content = {
    today,
    planner,
    projects,
    reports,
    profile
  };
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": theme,
    "data-mode": mode,
    style: {
      height: '100vh',
      width: '100%',
      maxWidth: 430,
      margin: '0 auto',
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(AppShell, {
    posture: "tabs",
    active: tab,
    onNavigate: setTab
  }, Object.entries(content).map(([id, node]) => /*#__PURE__*/React.createElement("div", {
    key: id,
    style: {
      display: tab === id ? 'block' : 'none',
      height: '100%',
      overflow: 'auto'
    }
  }, node))), tab !== 'today' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 76,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement(Island, {
    running: running,
    elapsed: fmt(secs),
    punched: true,
    expanded: expanded,
    onToggle: () => setExpanded(!expanded),
    actions: [running ? {
      label: paused ? 'Weiter' : 'Pause',
      onClick: () => setPaused(!paused)
    } : {
      label: 'Start',
      onClick: () => setRunning(true)
    }, running ? {
      label: 'Stop',
      onClick: () => {
        setRunning(false);
        setPaused(false);
        setAskMood(true);
      }
    } : {
      label: 'Today',
      onClick: () => setTab('today')
    }, {
      label: 'Ausstempeln',
      onClick: () => {
        setRunning(false);
        setPaused(false);
        setAskMood(true);
      }
    }]
  })));
}
const __dtPhoneRootEl = document.getElementById('root');
__dtPhoneRootEl.__reactRoot = __dtPhoneRootEl.__reactRoot || ReactDOM.createRoot(__dtPhoneRootEl);
__dtPhoneRootEl.__reactRoot.render(/*#__PURE__*/React.createElement(PhoneApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/devtime/phone.jsx", error: String((e && e.message) || e) }); }

__ds_ns.DayBlock = __ds_scope.DayBlock;

__ds_ns.Island = __ds_scope.Island;

__ds_ns.AIAskBar = __ds_scope.AIAskBar;

__ds_ns.AICallout = __ds_scope.AICallout;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ICON_PATHS = __ds_scope.ICON_PATHS;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.BoxPlot = __ds_scope.BoxPlot;

__ds_ns.BudgetRing = __ds_scope.BudgetRing;

__ds_ns.CheckinCard = __ds_scope.CheckinCard;

__ds_ns.Heatmap = __ds_scope.Heatmap;

__ds_ns.LeaveBalance = __ds_scope.LeaveBalance;

__ds_ns.LoadMeter = __ds_scope.LoadMeter;

__ds_ns.MoodCheck = __ds_scope.MoodCheck;

__ds_ns.OvertimeGauge = __ds_scope.OvertimeGauge;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.WeekSparkline = __ds_scope.WeekSparkline;

__ds_ns.AppShell = __ds_scope.AppShell;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
