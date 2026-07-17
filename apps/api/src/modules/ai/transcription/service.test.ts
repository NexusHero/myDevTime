import { describe, expect, it } from 'vitest'
import type { TranscriptSegment } from '@mydevtime/domain'
import {
  MEETING_INSIGHTS_CREDIT_COST,
  planMeetingInsights,
  type MeetingInsightsGates,
} from './service.js'
import { NullTranscription } from './null-transcription.js'
import { TranscriptionUnavailableError, type AudioInput, type TranscriptionPort } from './port.js'

const audio: AudioInput = { base64: 'AAAA', mimeType: 'audio/webm' }
const segments: TranscriptSegment[] = [
  { startMs: 0, endMs: 1000, text: 'We reviewed the roadmap' },
  { startMs: 1000, endMs: 2000, text: 'Action: Alice will send the report' },
]
const openGates = (over: Partial<MeetingInsightsGates> = {}): MeetingInsightsGates => ({
  consented: true,
  hasPro: true,
  ...over,
})

/** A tiny in-memory ASR adapter for the seam tests — the live adapter is spike-gated (#31). */
class FakeAsr implements TranscriptionPort {
  readonly provider = 'asr' as const
  constructor(
    private readonly segs: readonly TranscriptSegment[],
    private readonly up = true,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  transcribe(_audio: AudioInput): Promise<readonly TranscriptSegment[]> {
    if (!this.up) return Promise.reject(new TranscriptionUnavailableError('asr'))
    return Promise.resolve(this.segs)
  }
}

describe('planMeetingInsights', () => {
  it('WithoutConsent_ProducesNothing_evenWithAWorkingAsr', async () => {
    const r = await planMeetingInsights(
      new FakeAsr(segments),
      audio,
      openGates({ consented: false }),
    )
    expect(r.status).toBe('no-consent')
    expect(r.transcript).toEqual([])
    expect(r.actionItems).toEqual([])
  })

  it('WithoutPro_ProducesNothing', async () => {
    const r = await planMeetingInsights(new FakeAsr(segments), audio, openGates({ hasPro: false }))
    expect(r.status).toBe('not-pro')
    expect(r.actionItems).toEqual([])
  })

  it('ConsentedPro_ProducesFactsAndConfirmedOnlyActionItems', async () => {
    const r = await planMeetingInsights(new FakeAsr(segments), audio, openGates())
    expect(r.status).toBe('ok')
    expect(r.facts.length).toBeGreaterThan(0)
    expect(r.actionItems.length).toBeGreaterThanOrEqual(1)
    for (const item of r.actionItems) {
      expect(item.source).toBe('ai-proposal')
      expect(item.confirmed).toBe(false)
    }
  })

  it('UnavailableAsr_DegradesToEmpty', async () => {
    const r = await planMeetingInsights(new FakeAsr(segments, false), audio, openGates())
    expect(r.status).toBe('unavailable')
    expect(r.transcript).toEqual([])
  })

  it('NullTranscription_IsAlwaysUnavailable', async () => {
    const r = await planMeetingInsights(new NullTranscription(), audio, openGates())
    expect(r.status).toBe('unavailable')
    expect(r.actionItems).toEqual([])
  })

  it('CreditCostIsOne_chargedOnConfirmationNotHere', async () => {
    const r = await planMeetingInsights(new FakeAsr(segments), audio, openGates())
    expect(r.creditCost).toBe(MEETING_INSIGHTS_CREDIT_COST)
    expect(MEETING_INSIGHTS_CREDIT_COST).toBe(1)
  })
})

describe('NullTranscription', () => {
  it('AvailableIsFalse_AndTranscribeRejects', async () => {
    const port = new NullTranscription()
    expect(await port.available()).toBe(false)
    await expect(port.transcribe(audio)).rejects.toBeInstanceOf(TranscriptionUnavailableError)
  })
})
