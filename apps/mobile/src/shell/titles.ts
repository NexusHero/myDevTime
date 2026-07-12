import type { Screen } from '@mydevtime/design'

/**
 * Human labels for every deep-linkable screen (ux-vision §3). Used by the
 * navigation chrome to draw the tab/sidebar items from the design package's
 * `PHONE_TABS` / `SIDEBAR_ITEMS` model.
 */
export const SCREEN_TITLES: Record<Screen, string> = {
  today: 'Today',
  planner: 'Planner',
  projects: 'Projects',
  project: 'Project',
  task: 'Task',
  reports: 'Reports',
  meetings: 'Meetings',
  meeting: 'Meeting',
  profile: 'Profile',
  worktime: 'Work time',
  absences: 'Absences',
  settings: 'Settings',
  credits: 'Credits',
  assistant: 'Assistant',
}
