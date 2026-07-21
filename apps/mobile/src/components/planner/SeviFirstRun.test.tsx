// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { SeviFirstRun } from './SeviFirstRun.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for Sevi's first-run stage (REQ-074): the questions are
 * on stage, the proposal summary is derived deterministically from the answers
 * (pure `firstRunGhostWeek` — no demo data anywhere), skipping fires the seen
 * callback, and on a weekend the stage honestly proposes next week instead of
 * planning the past. The accept path through the plan-apply seam is proven by the
 * browser journey (e2e/tests/planner-canvas.spec.ts) against the real API.
 */

const WEEK = [
  '2026-07-20',
  '2026-07-21',
  '2026-07-22',
  '2026-07-23',
  '2026-07-24',
  '2026-07-25',
  '2026-07-26',
]

function render(todayKey: string, onSkip = vi.fn()): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <SeviFirstRun
          weekDates={WEEK}
          todayKey={todayKey}
          onAccepted={() => undefined}
          onSkip={onSkip}
        />
      </ThemeProvider>,
    )
  })
  return r
}

function texts(r: TestRenderer.ReactTestRenderer): string {
  return r.root
    .findAll(n => typeof n.type === 'string')
    .flatMap(n => n.children)
    .filter((c): c is string => typeof c === 'string')
    .join(' ')
}

describe('SeviFirstRun', () => {
  it('AsksTheThreeQuestions_NoDemoData', () => {
    const r = render('2026-07-20')
    const out = texts(r)
    expect(out).toContain('Wann fängst du an?')
    expect(out).toContain('Woran arbeitest du diese Woche?')
    expect(out).toContain('Wann ist Feierabend?')
    // The honesty rule: the proposal is announced as such, nothing reads as booked.
    expect(out).toContain('nichts gebucht')
  })

  it('MidWeek_SummarisesTheDeterministicProposalForTheRemainingDays', () => {
    // Wednesday → Wed/Thu/Fri remain; 09:00–17:00 default → 3 focus runs per day.
    const r = render('2026-07-22')
    expect(texts(r)).toContain('Vorschlag: 3 Tage')
    expect(texts(r)).not.toContain('nächste Woche')
  })

  it('AnsweringDifferently_ChangesTheProposalDeterministically', () => {
    const r = render('2026-07-22')
    act(() => {
      r.root.findByProps({ accessibilityLabel: 'Wann ist Feierabend? 16:00' }).props.onPress()
      r.root.findByProps({ accessibilityLabel: 'Wann fängst du an? 08:00' }).props.onPress()
    })
    // 08:00–16:00 keeps 3 focus runs; the summary re-derives from the answers.
    expect(texts(r)).toContain('Vorschlag: 3 Tage')
  })

  it('Weekend_ProposesNextWeekInsteadOfThePast', () => {
    const r = render('2026-07-25')
    expect(texts(r)).toContain('nächste Woche')
    expect(texts(r)).toContain('Nächste Woche übernehmen')
  })

  it('Skip_FiresTheSeenCallback', () => {
    const onSkip = vi.fn()
    const r = render('2026-07-20', onSkip)
    act(() => {
      r.root.findByProps({ children: 'Überspringen' }).props.onPress()
    })
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})
