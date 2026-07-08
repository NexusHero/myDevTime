import { describe, expect, it } from 'vitest'
import { PHONE_TABS, ROUTES, SIDEBAR_ITEMS, buildPath, parsePath, type Screen } from './nav.js'

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
    for (const s of [...PHONE_TABS, ...SIDEBAR_ITEMS]) expect(screens.has(s)).toBe(true)
    expect(PHONE_TABS).toHaveLength(5) // ux-vision §3: five bottom tabs
    expect(SIDEBAR_ITEMS).toContain('meetings') // promoted to top level on wide layouts
    expect(PHONE_TABS).not.toContain('meetings')
  })
})
