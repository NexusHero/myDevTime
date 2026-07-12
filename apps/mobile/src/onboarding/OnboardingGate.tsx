import { useState } from 'react'
import { OnboardingFlow } from './OnboardingFlow'
import { hasOnboarded, markOnboarded } from './onboardingStore'

/**
 * First-run gate (design v3): shows the onboarding flow once, then hands the
 * device to the workspace and never shows it again. The seen/not-seen flag lives
 * in `onboardingStore` (localStorage on web, in-memory on native until a durable
 * store is wired). State is seeded synchronously from the flag so a returning
 * user paints straight into the app with no onboarding flash.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [done, setDone] = useState(hasOnboarded)

  if (!done) {
    return (
      <OnboardingFlow
        onDone={() => {
          markOnboarded()
          setDone(true)
        }}
      />
    )
  }

  return <>{children}</>
}
