// Minimal inline icon set (stroke style, 24px viewBox) — no icon-font dependency.

const paths: Record<string, JSX.Element> = {
  today: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="3" />
      <path d="M4 10h16M9 3v4M15 3v4" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
  planner: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 4v17M14 4v17" />
    </>
  ),
  projects: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </>
  ),
  meetings: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7v5l3 3" />
      <path d="M17 3l4 4-4 1z" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="2.6" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  punch: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M7 5c0-1 .8-1 .8-2M11 5c0-1 .8-1 .8-2" />
    </>
  ),
  check: <path d="M5 13l4 4L19 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  sparkle: (
    <>
      <path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3z" />
      <path d="M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l5 5" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  download: (
    <>
      <path d="M12 4v10M8 10l4 4 4-4" />
      <path d="M5 20h14" />
    </>
  ),
}

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      className="nav-ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {paths[name]}
    </svg>
  )
}
