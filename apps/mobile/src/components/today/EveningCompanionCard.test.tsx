// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import { Button } from '../index.js'
import type { CompanionDayInput } from '../../api/companion.js'

/**
 * Render tests (ADR-0027) for the Evening Companion card (design v14 §H, REQ wellbeing). The
 * companion api is mocked so the test pins the CLIENT contract: the card starts as a single "Reflect
 * on today" button; an `ai-proposal` response renders the warm message, the wellbeing band + week
 * trend, the top signals as human lines, an "AI proposal" chip that owns up to the spent credit, and
 * the ONE forward suggestion whose confirm hands the proposal to the caller (never booking); a
 * `deterministic` response is shown as a FREE, still-caring reflection — never as AI, never claiming a
 * charge (ADR-0005).
 */
const { requestEveningCompanion } = vi.hoisted(() => ({
  requestEveningCompanion: vi.fn(),
}))
vi.mock('../../api/companion.js', () => ({ requestEveningCompanion }))

const { EveningCompanionCard } = await import('./EveningCompanionCard.js')

const DAY: CompanionDayInput = {
  plannedMinutes: 360,
  actualMinutes: 600,
  overtimeMinutes: 90,
  breakShortfallMinutes: 30,
  meetingCount: 6,
  backToBackMeetingCount: 3,
  planDriftMinutes: 240,
  isAbsenceDay: false,
}
const DATE = '2026-07-19'
const TZ = 'Europe/Berlin'

const AI_RESPONSE = {
  review: {
    loadLevel: 'heavy',
    loadScore: 7.2,
    signals: [
      { kind: 'overtime', severity: 'medium', detail: { overtimeMinutes: 90 } },
      { kind: 'back-to-back-meetings', severity: 'high', detail: { count: 3 } },
    ],
  },
  baseline: { normalLow: 4, normalHigh: 6, trend: 'rising', patternFlags: [] },
  message: {
    source: 'ai-proposal',
    text: 'A full one — let it go for the evening.',
    charged: true,
  },
  suggestion: {
    kind: 'protect-morning',
    text: 'Guard your first hour tomorrow.',
    provenance: 'ai-proposal',
  },
}

function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
  })
  return r
}
function tree(r: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(r.toJSON())
}
function button(r: TestRenderer.ReactTestRenderer, label: string): TestRenderer.ReactTestInstance {
  const b = r.root.findAllByType(Button).find(x => x.props.children === label)
  expect(b, label).toBeDefined()
  return b!
}
async function press(b: TestRenderer.ReactTestInstance): Promise<void> {
  await act(async () => {
    ;(b.props.onPress as () => void)()
  })
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('EveningCompanionCard', () => {
  it('Initial_ShowsTheReflectButton_AndNoReflection', () => {
    const r = render(
      <EveningCompanionCard baseUrl="https://api.test" date={DATE} tz={TZ} day={DAY} />,
    )
    expect(button(r, 'Reflect on today')).toBeDefined()
    expect(tree(r)).not.toContain('1 credit used')
    expect(tree(r)).not.toContain('AI proposal')
  })

  it('AiProposal_RendersMessageBandTrendSignalsAndCreditChip_AndSuggestionConfirm', async () => {
    requestEveningCompanion.mockResolvedValueOnce(AI_RESPONSE)
    const onConfirmSuggestion = vi.fn()
    const r = render(
      <EveningCompanionCard
        baseUrl="https://api.test"
        date={DATE}
        tz={TZ}
        day={DAY}
        onConfirmSuggestion={onConfirmSuggestion}
      />,
    )
    await press(button(r, 'Reflect on today'))

    expect(requestEveningCompanion).toHaveBeenCalledTimes(1)
    expect(requestEveningCompanion.mock.calls[0]?.[1]).toEqual({ date: DATE, tz: TZ, day: DAY })

    const out = tree(r)
    expect(out).toContain('A full one — let it go for the evening.')
    expect(out).toContain('Heavy') // the wellbeing band
    expect(out).toContain('This week has been building') // the week trend
    expect(out).toContain('90 min of overtime') // a signal as a human line
    expect(out).toContain('3 meetings ran back-to-back')
    expect(out).toContain('AI proposal')
    expect(out).toContain('1 credit used')
    expect(out).toContain('Guard your first hour tomorrow.')

    // the suggestion confirm hands the proposal up — it never books here
    await press(button(r, 'Protect tomorrow morning'))
    expect(onConfirmSuggestion).toHaveBeenCalledWith(AI_RESPONSE.suggestion)
  })

  it('Deterministic_RendersAsFreeReflection_WithNoChargedClaim', async () => {
    requestEveningCompanion.mockResolvedValueOnce({
      ...AI_RESPONSE,
      message: {
        source: 'deterministic',
        text: 'A full day — you showed up for it.',
        charged: false,
      },
    })
    const r = render(
      <EveningCompanionCard baseUrl="https://api.test" date={DATE} tz={TZ} day={DAY} />,
    )
    await press(button(r, 'Reflect on today'))

    const out = tree(r)
    expect(out).toContain('A full day — you showed up for it.')
    expect(out).toContain('Free reflection')
    expect(out).toContain('Reflection')
    expect(out).not.toContain('AI proposal')
    expect(out).not.toContain('1 credit used')
  })

  it('DemoData_DisablesReflect_AndInvitesConnect', () => {
    const r = render(<EveningCompanionCard baseUrl={null} date={DATE} tz={TZ} day={DAY} />)
    expect(button(r, 'Reflect on today').props.disabled).toBe(true)
    expect(tree(r)).toContain('Connect an account')
  })
})
