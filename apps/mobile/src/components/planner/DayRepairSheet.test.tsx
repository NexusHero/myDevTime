// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { Pressable } from 'react-native'
import { DayRepairSheet } from './DayRepairSheet.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'
import type { DayRepairResource } from '../../hooks/useDayRepair.js'

/**
 * Render tests (ADR-0027) for the day-repair chip + ghost preview (ADR-0072 D1, REQ-072).
 * Pinned: nothing renders while the day needs no repair; the chip opens the preview; the
 * placements render as labeled ghosts; the stretch price / moved names are visible BEFORE
 * any confirm; Confirm calls exactly `apply`, Dismiss calls exactly `dismiss` — the
 * component itself never mutates anything.
 */

function makeRepair(overrides: Partial<DayRepairResource> = {}): DayRepairResource {
  return {
    proposal: { placements: [{ id: '0', startMin: 720, lenMin: 60 }], overflow: { kind: 'fits' } },
    price: null,
    placements: [
      { id: '0', label: 'Deep work', startMin: 720, lenMin: 60, timeLabel: '12:00–13:00' },
    ],
    movedLabels: [],
    previewOpen: false,
    openPreview: vi.fn(),
    apply: vi.fn(),
    dismiss: vi.fn(),
    applying: false,
    error: null,
    ...overrides,
  }
}

function render(repair: DayRepairResource, chip = true): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <DayRepairSheet repair={repair} chip={chip} />
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

function pressByLabel(r: TestRenderer.ReactTestRenderer, label: string): void {
  const p = r.root
    .findAllByType(Pressable)
    .find(x => (x.props as { accessibilityLabel?: string }).accessibilityLabel === label)
  expect(p, `pressable "${label}"`).toBeDefined()
  act(() => {
    ;(p!.props as { onPress: () => void }).onPress()
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('DayRepairSheet', () => {
  it('NoProposal_RendersNothingAtAll', () => {
    const r = render(makeRepair({ proposal: null, placements: [] }))
    expect(r.toJSON()).toBeNull()
  })

  it('Chip_ShowsTheRepairHandle_AndOpensThePreview', () => {
    const repair = makeRepair()
    const r = render(repair)
    expect(texts(r)).toContain('Plan gerissen · Reparieren')
    pressByLabel(r, 'Plan gerissen · Reparieren')
    expect(repair.openPreview).toHaveBeenCalledTimes(1)
    expect(repair.apply).not.toHaveBeenCalled() // opening the preview mutates nothing
  })

  it('ChipSuppressed_WhenAnExistingChipIsTheHandle', () => {
    const r = render(makeRepair(), false)
    expect(texts(r)).not.toContain('Plan gerissen')
  })

  it('Preview_RendersGhostPlacements_WithTimesAndLabels', () => {
    const r = render(
      makeRepair({
        previewOpen: true,
        placements: [
          { id: '0', label: 'Deep work', startMin: 720, lenMin: 60, timeLabel: '12:00–13:00' },
          { id: '1', label: 'Docs', startMin: 780, lenMin: 60, timeLabel: '13:00–14:00' },
        ],
      }),
    )
    const body = texts(r)
    expect(body).toContain('Deep work')
    expect(body).toContain('12:00–13:00')
    expect(body).toContain('Docs')
    expect(body).toContain('13:00–14:00')
    expect(body).toContain('nothing moves without your tap')
  })

  it('StretchPreview_ShowsThePriceLine_BeforeAnyTap', () => {
    const repair = makeRepair({
      previewOpen: true,
      price: '+60 min über deiner Linie · Feierabend ~19:30',
    })
    const r = render(repair)
    expect(texts(r)).toContain('+60 min über deiner Linie · Feierabend ~19:30')
    expect(repair.apply).not.toHaveBeenCalled()
  })

  it('MovedPreview_NamesTheBlocksThatLeaveTheDay', () => {
    const r = render(
      makeRepair({ previewOpen: true, movedLabels: ['Late run', 'Refactor billing'] }),
    )
    expect(texts(r)).toContain('tomorrow/backlog: Late run, Refactor billing')
  })

  it('Confirm_CallsApplyExactlyOnce', () => {
    const repair = makeRepair({ previewOpen: true })
    const r = render(repair)
    pressByLabel(r, 'Confirm repair')
    expect(repair.apply).toHaveBeenCalledTimes(1)
    expect(repair.dismiss).not.toHaveBeenCalled()
  })

  it('Dismiss_CallsDismissOnly_NeverApply', () => {
    const repair = makeRepair({ previewOpen: true })
    const r = render(repair)
    pressByLabel(r, 'Dismiss repair')
    expect(repair.dismiss).toHaveBeenCalledTimes(1)
    expect(repair.apply).not.toHaveBeenCalled()
  })

  it('ApplyFailure_IsSurfacedHonestly', () => {
    const r = render(makeRepair({ previewOpen: true, error: new Error('offline') }))
    expect(texts(r)).toContain('Repair not applied — offline')
  })
})
