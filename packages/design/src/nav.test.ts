import { describe, expect, it } from 'vitest'
import {
  PHONE_TABS,
  PROFILE_HUB_LINKS,
  ROUTES,
  SIDEBAR_ITEMS,
  buildPath,
  parsePath,
  type Screen,
} from './nav.js'

describe('navigation route map', () => {
  it('BuildPath_StaticAndParameterized', () => {
    expect(buildPath('today')).toBe('/today')
    expect(buildPath('project', { projectId: 'p1' })).toBe('/projects/p1')
    expect(buildPath('settings')).toBe('/profile/settings')
  })

  it('BuildPath_MissingParam_Throws', () => {
    expect(() => buildPath('project')).toThrow(/projectId/)
    expect(() => buildPath('task', { taskId: '' })).toThrow()
  })

  it('ParsePath_MatchesStaticAndDynamic', () => {
    expect(parsePath('/today')).toEqual({ screen: 'today', params: {} })
    expect(parsePath('/projects/p1')).toEqual({ screen: 'project', params: { projectId: 'p1' } })
    expect(parsePath('/meetings/m9')).toEqual({ screen: 'meeting', params: { meetingId: 'm9' } })
  })

  it('ParsePath_UnknownIsNull', () => {
    expect(parsePath('/nope')).toBeNull()
    expect(parsePath('/projects/p1/extra')).toBeNull()
  })

  it('ParsePath_IgnoresQueryAndHash', () => {
    expect(parsePath('/reports?range=month#top')).toEqual({ screen: 'reports', params: {} })
  })

  it('BuildThenParse_RoundTrips_ForEveryRoute', () => {
    for (const route of ROUTES) {
      const params = Object.fromEntries(route.params.map(p => [p, `${p}-val`]))
      const path = buildPath(route.screen, params)
      expect(parsePath(path)).toEqual({ screen: route.screen, params })
    }
  })

  it('Params_AreUrlEncodedAndDecoded', () => {
    const path = buildPath('project', { projectId: 'a/b c' })
    expect(path).toBe('/projects/a%2Fb%20c')
    expect(parsePath(path)).toEqual({ screen: 'project', params: { projectId: 'a/b c' } })
  })

  it('NavSets_AreValidScreensWithRoutes', () => {
    const screens = new Set<Screen>(ROUTES.map(r => r.screen))
    for (const s of [...PHONE_TABS, ...SIDEBAR_ITEMS, ...PROFILE_HUB_LINKS])
      expect(screens.has(s)).toBe(true)
    expect(PHONE_TABS).toHaveLength(5) // ux-vision §3: five bottom tabs
    expect(SIDEBAR_ITEMS).toContain('meetings') // promoted to top level on wide layouts
    expect(PHONE_TABS).not.toContain('meetings')
  })

  it('SecondarySurfaces_ReachableFromSomeNav', () => {
    // Regression: the Assistant screen shipped built but wired into no nav at all —
    // unreachable except by typing its URL. Every surface must have an entry point.
    const reachable = new Set<Screen>([...PHONE_TABS, ...SIDEBAR_ITEMS, ...PROFILE_HUB_LINKS])
    expect(reachable.has('assistant')).toBe(true)
    expect(reachable.has('meetings')).toBe(true)
  })

  it('ProfileHubLinks_GivePhoneAPathToOffTabSurfaces', () => {
    // ux-vision §3 fixes the phone to five tabs, so Meetings and the Assistant reach
    // the phone through the Profile hub rather than a sixth tab.
    expect(PROFILE_HUB_LINKS).toEqual(['meetings', 'assistant'])
    for (const s of PROFILE_HUB_LINKS) expect(PHONE_TABS).not.toContain(s)
  })

  it('Sidebar_PromotesBothSecondarySurfaces', () => {
    // Wide layouts have room: both Meetings and the Assistant are first-class there.
    expect(SIDEBAR_ITEMS).toContain('meetings')
    expect(SIDEBAR_ITEMS).toContain('assistant')
  })

  it('Sidebar_PromotesAbsence_ButPhoneKeepsItUnderProfile', () => {
    // Design v3: Absence is a first-class sidebar destination on wide layouts,
    // but stays off the five-tab phone bar (reached via the Profile hub there).
    expect(SIDEBAR_ITEMS).toContain('absences')
    expect(PHONE_TABS).not.toContain('absences')
  })
})
