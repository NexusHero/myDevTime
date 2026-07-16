import { useEffect, useState } from 'react'
import { OnboardingFlow } from './OnboardingFlow'
import { hasOnboarded, markOnboarded } from './onboardingStore'
import { apiBaseUrl } from '../config'
import { getPreferences, updatePreferences } from '../api/preferences'

/**
 * First-run gate (design v3, ADR-0036): shows the onboarding flow once, then hands
 * the device to the workspace and never shows it again.
 *
 * The seen/not-seen flag is **durable and cross-device** via the server preference
 * `onboarded` (REQ-044, audit M11): the previous native path kept it only in
 * memory, so the whole flow re-appeared on every cold start. The local
 * `onboardingStore` (localStorage on web) is kept as a fast synchronous cache — a
 * returning user with the local flag set paints straight into the app with no
 * onboarding flash, and the server is the source of truth reconciled in the
 * background. With no API configured (local demo), only the local flag is used.
 */
type GateState = 'checking' | 'onboarding' | 'done'

export function OnboardingGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<GateState>(() =>
    hasOnboarded() ? 'done' : apiBaseUrl === null ? 'onboarding' : 'checking',
  )

  useEffect(() => {
    if (state !== 'checking' || apiBaseUrl === null) return
    let alive = true
    getPreferences(apiBaseUrl)
      .then(prefs => {
        if (!alive) return
        if (prefs.onboarded) markOnboarded() // cache locally so the next launch is instant
        setState(prefs.onboarded ? 'done' : 'onboarding')
      })
      .catch(() => {
        // Offline / unreachable: fall back to the local flag rather than block.
        if (alive) setState(hasOnboarded() ? 'done' : 'onboarding')
      })
    return () => {
      alive = false
    }
  }, [state])

  // Brief, only on a device with no local flag yet; the native splash covers a cold start.
  if (state === 'checking') return <></>

  if (state === 'onboarding') {
    return (
      <OnboardingFlow
        onDone={() => {
          markOnboarded()
          if (apiBaseUrl !== null) {
            void updatePreferences(apiBaseUrl, { onboarded: true }).catch(() => undefined)
          }
          setState('done')
        }}
      />
    )
  }

  return <>{children}</>
}
