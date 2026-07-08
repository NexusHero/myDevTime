/**
 * Navigation model (issue #11) — the app shell's route map as pure data + pure
 * path build/parse. The IA is fixed by ux-vision §3; every screen has a
 * deep-link route so the AI assistant (and OS quick actions, REQ-039) can link
 * straight into one. This is platform-independent: React Navigation / Expo Router
 * on native and the URL bar on web both drive the same `Screen` + params.
 */

/** Every deep-linkable surface. */
export type Screen =
  | 'today'
  | 'planner'
  | 'projects'
  | 'project' // { projectId }
  | 'task' // { taskId }
  | 'reports'
  | 'meetings'
  | 'meeting' // { meetingId }
  | 'profile'
  | 'absences'
  | 'settings'
  | 'credits'
  | 'assistant'

export interface RouteDef {
  readonly screen: Screen
  /** Path template with `:param` placeholders, e.g. `/projects/:projectId`. */
  readonly path: string
  /** Required param names parsed from the template. */
  readonly params: readonly string[]
}

function def(screen: Screen, path: string): RouteDef {
  const params = path
    .split('/')
    .filter(seg => seg.startsWith(':'))
    .map(seg => seg.slice(1))
  return { screen, path, params }
}

/** The route table (ux-vision §3 IA). Order is irrelevant — matching is by segments. */
export const ROUTES: readonly RouteDef[] = [
  def('today', '/today'),
  def('planner', '/planner'),
  def('projects', '/projects'),
  def('project', '/projects/:projectId'),
  def('task', '/tasks/:taskId'),
  def('reports', '/reports'),
  def('meetings', '/meetings'),
  def('meeting', '/meetings/:meetingId'),
  def('profile', '/profile'),
  def('absences', '/profile/absences'),
  def('settings', '/profile/settings'),
  def('credits', '/profile/credits'),
  def('assistant', '/assistant'),
]

const BY_SCREEN: ReadonlyMap<Screen, RouteDef> = new Map(ROUTES.map(r => [r.screen, r]))

/** Bottom tabs on phone (ux-vision §3): Today · Planner · Projects · Reports · Profile. */
export const PHONE_TABS: readonly Screen[] = ['today', 'planner', 'projects', 'reports', 'profile']

/** Sidebar items on tablet/desktop: the five tabs + Meetings promoted to top level. */
export const SIDEBAR_ITEMS: readonly Screen[] = [
  'today',
  'planner',
  'projects',
  'reports',
  'meetings',
  'profile',
]

/** Build a path for a screen. Throws if a required param is missing. */
export function buildPath(screen: Screen, params: Readonly<Record<string, string>> = {}): string {
  const route = BY_SCREEN.get(screen)
  if (!route) throw new Error(`unknown screen: ${screen}`)
  return route.path
    .split('/')
    .map(seg => {
      if (!seg.startsWith(':')) return seg
      const key = seg.slice(1)
      const value = params[key]
      if (value === undefined || value === '') throw new Error(`missing route param: ${key}`)
      return encodeURIComponent(value)
    })
    .join('/')
}

export interface Match {
  readonly screen: Screen
  readonly params: Readonly<Record<string, string>>
}

/** Parse a path (query/hash ignored) to a screen + params, or null if unmatched. */
export function parsePath(path: string): Match | null {
  const clean = path.split(/[?#]/)[0] ?? ''
  const segs = clean.split('/').filter(Boolean)
  for (const route of ROUTES) {
    const tmpl = route.path.split('/').filter(Boolean)
    if (tmpl.length !== segs.length) continue
    const params: Record<string, string> = {}
    let ok = true
    for (const [i, t] of tmpl.entries()) {
      const s = segs[i] ?? '' // same length as tmpl → always defined
      if (t.startsWith(':')) params[t.slice(1)] = decodeURIComponent(s)
      else if (t !== s) {
        ok = false
        break
      }
    }
    if (ok) return { screen: route.screen, params }
  }
  return null
}
