import React from 'react'
import Svg, { Path } from 'react-native-svg'

/** Brand icon set — 24px grid, 2px stroke. */
const ICON_PATHS: Record<string, string> = {
  today: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  timer: 'M12 8.5v4.5l3 2M9 2h6M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  planner: 'M4 6h16M4 12h16M4 18h10',
  projects: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  reports: 'M5 21V9M12 21V3M19 21v-7',
  meetings:
    'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1.5-4 5-6 8-6s6.5 2 8 6',
  assistant:
    'M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6zM18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z',
  settings:
    'M4 8h8M17 8h3M4 16h4M12 16h8M14.5 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9.5 13.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
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
  chevronRight: 'M10 6l6 6-6 6',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5v.5',
}

export interface IconProps {
  readonly name?: string
  readonly size?: number
  readonly color?: string
}

export function Icon({
  name = 'today',
  size = 20,
  color = 'currentColor',
}: IconProps): React.JSX.Element {
  const path = ICON_PATHS[name] || ICON_PATHS.today

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={path ?? 'M0 0'} />
    </Svg>
  )
}
