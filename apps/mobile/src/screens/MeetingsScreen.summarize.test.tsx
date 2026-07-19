// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { TextInput } from 'react-native'
import { ThemeProvider } from '../theme/ThemeProvider.js'
import { Button } from '../components/index.js'
import type { MeetingInsightsResult } from '../api/meetingInsights.js'

/**
 * The Meetings "Summarize a transcript" surface (REQ-026, #33): pasting a transcript and pressing
 * Summarize calls the real `/api/ai/meeting-insights` client and renders the result with honest
 * provenance — an `ai-proposal` summary is marked as having spent a credit; a `deterministic`
 * summary is labelled a free degradation and never claims a charge. Facts + action items render as
 * proposals (nothing is booked). The api + config are mocked so no network runs.
 */
const { requestMeetingInsights } = vi.hoisted(() => ({ requestMeetingInsights: vi.fn() }))
vi.mock('../api/meetingInsights', () => ({ requestMeetingInsights }))
vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

// Imported after the mocks so the component binds to them.
const { TranscriptInsights } = await import('./MeetingsScreen.js')

afterEach(() => {
  requestMeetingInsights.mockReset()
})

function render(): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <TranscriptInsights />
      </ThemeProvider>,
    )
  })
  return r
}

function summarizeButton(r: TestRenderer.ReactTestRenderer): TestRenderer.ReactTestInstance {
  return r.root.findAllByType(Button).find(b => String(b.props.children).includes('Summarize'))!
}

async function run(r: TestRenderer.ReactTestRenderer, transcript: string): Promise<void> {
  await act(async () => {
    r.root.findAllByType(TextInput)[0]!.props.onChangeText(transcript)
  })
  await act(async () => {
    summarizeButton(r).props.onPress()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('MeetingsScreen · TranscriptInsights', () => {
  it('AiProposalSummary_RendersCreditUsedFactsAndProposals', async () => {
    const result: MeetingInsightsResult = {
      summary: {
        source: 'ai-proposal',
        text: 'We agreed to ship the pricing API on Friday.',
        charged: true,
      },
      facts: ['Pricing API ships Friday.'],
      actionItems: [{ text: 'Draft the release notes.', provenance: 'ai-proposal' }],
    }
    requestMeetingInsights.mockResolvedValueOnce(result)

    const r = render()
    await run(r, 'Alice: we ship pricing Friday. Bob: I will draft notes.')

    expect(requestMeetingInsights).toHaveBeenCalledTimes(1)
    const json = JSON.stringify(r.toJSON())
    expect(json).toContain('We agreed to ship the pricing API on Friday.')
    expect(json).toContain('1 credit used')
    expect(json).toContain('Pricing API ships Friday.')
    expect(json).toContain('Draft the release notes.')
    expect(json).toContain('proposal')
  })

  it('DeterministicSummary_LabelledFree_NeverClaimsACharge', async () => {
    const result: MeetingInsightsResult = {
      summary: { source: 'deterministic', text: 'Pricing API ships Friday.', charged: false },
      facts: ['Pricing API ships Friday.'],
      actionItems: [],
    }
    requestMeetingInsights.mockResolvedValueOnce(result)

    const r = render()
    await run(r, 'we ship pricing friday')

    const json = JSON.stringify(r.toJSON())
    expect(json).toContain('Free — provider unavailable')
    expect(json).not.toContain('1 credit used')
  })
})
