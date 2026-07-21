import { describe, expect, it } from 'vitest'
import { act, useEffect } from 'react'
import TestRenderer from 'react-test-renderer'
import { ACCENT_THEMES, blockStateStyle, palettes, type AccentTheme } from '@mydevtime/design'
import type { PlannerBlockState } from '@mydevtime/design'
import { PlanBlockView } from './PlanBlockView.js'
import { ThemeProvider, useAccent, useThemePref } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the redesigned plan block (issue #341): the four
 * states are unmistakable — each carries its marker glyph and state label — in
 * light AND dark across ALL THREE accents, and the project colour is worn only
 * as the left edge, never as the block's fill.
 */

function ThemeSetter({
  mode,
  accent,
  children,
}: {
  readonly mode: 'dark' | 'light'
  readonly accent: AccentTheme
  readonly children: React.ReactNode
}): React.JSX.Element {
  const { setPref } = useThemePref()
  const { setAccent } = useAccent()
  useEffect(() => {
    setPref(mode)
    setAccent(accent)
  }, [mode, accent, setPref, setAccent])
  return <>{children}</>
}

function render(
  mode: 'dark' | 'light',
  accent: AccentTheme,
  state: PlannerBlockState,
): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(
      <ThemeProvider>
        <ThemeSetter mode={mode} accent={accent}>
          <PlanBlockView
            label="Sync-Engine"
            timeLabel="09:00–11:00"
            state={state}
            edgeColor="#1fa894"
            top={40}
            height={80}
          />
        </ThemeSetter>
      </ThemeProvider>,
    )
  })
  return r
}

/** Flatten a (possibly nested-array) RN style prop into one object. */
function flat(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...flat(s) }), {})
  }
  return style != null && typeof style === 'object' ? (style as Record<string, unknown>) : {}
}

const GLYPH: Record<PlannerBlockState, string | null> = {
  planned: null,
  live: '●',
  done: '✓',
  missed: '!',
}
const STATES: readonly PlannerBlockState[] = ['planned', 'live', 'done', 'missed']
const COMBOS = ACCENT_THEMES.flatMap(accent =>
  (['light', 'dark'] as const).map(mode => ({ accent, mode })),
)

describe('PlanBlockView', () => {
  for (const { accent, mode } of COMBOS) {
    describe(`${accent}/${mode}`, () => {
      it.each(STATES)('%s · marker, state label, edge-not-fill', state => {
        const r = render(mode, accent, state)
        const root = r.root.findByProps({
          accessibilityLabel: `Sync-Engine, 09:00–11:00, ${state === 'live' ? 'live now' : state}`,
        })
        const style = flat(root.props.style)
        const expected = blockStateStyle(state, palettes[accent][mode])
        // The fill is the state's neutral surface — never the project colour.
        expect(style['backgroundColor']).toBe(expected.fill)
        expect(style['backgroundColor']).not.toBe('#1fa894')
        // The project colour lives on the edge.
        expect(style['borderLeftColor']).toBe('#1fa894')
        expect(style['borderLeftWidth']).toBe(3)
        // Missed is the only dashed frame; done the only receding one.
        expect(style['borderStyle']).toBe(state === 'missed' ? 'dashed' : 'solid')
        expect(style['opacity']).toBe(state === 'done' ? 0.8 : 1)
        // The state marker glyph is present (planned carries none).
        const texts = r.root
          .findAll(n => typeof n.type === 'string')
          .flatMap(n => n.children)
          .filter((c): c is string => typeof c === 'string')
        expect(texts).toContain('Sync-Engine')
        expect(texts).toContain('09:00–11:00')
        const glyph = GLYPH[state]
        if (glyph !== null) expect(texts).toContain(glyph)
        else expect(texts.some(x => ['●', '✓', '!'].includes(x))).toBe(false)
      })
    })
  }

  it('TinyBlock_DropsTextButKeepsStateInTheA11yLabel', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <PlanBlockView
            label="Standup"
            timeLabel="09:00–09:15"
            state="planned"
            edgeColor="#1fa894"
            top={0}
            height={10}
          />
        </ThemeProvider>,
      )
    })
    const root = r.root.findByProps({ accessibilityLabel: 'Standup, 09:00–09:15, planned' })
    expect(root).toBeTruthy()
    const texts = r.root
      .findAll(n => typeof n.type === 'string')
      .flatMap(n => n.children)
      .filter((c): c is string => typeof c === 'string')
    expect(texts).not.toContain('Standup')
  })
})
