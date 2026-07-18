// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { PlannerNewEntryDialog, type NewEntryDraft } from './PlannerNewEntryDialog.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the v19 New-Entry dialog: it collects a Task or Life draft and hands
 * it up (never persists itself); Life hides the project/priority controls; and it invents no data.
 */
function render(node: React.ReactElement): TestRenderer.ReactTestRenderer {
  let r!: TestRenderer.ReactTestRenderer
  act(() => {
    r = TestRenderer.create(<ThemeProvider>{node}</ThemeProvider>)
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

const PROJECTS = [
  { id: 'p1', name: 'Finanzo' },
  { id: 'p2', name: 'Sync engine' },
]

describe('PlannerNewEntryDialog', () => {
  it('RendersNothingWhenClosed', () => {
    const r = render(
      <PlannerNewEntryDialog
        visible={false}
        projects={PROJECTS}
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    )
    expect(r.toJSON()).toBeNull()
  })

  it('Task_ShowsProjectAndPriorityControls', () => {
    const out = texts(
      render(
        <PlannerNewEntryDialog
          visible
          projects={PROJECTS}
          onClose={() => {}}
          onSubmit={() => {}}
          onCreateProject={() => {}}
        />,
      ),
    )
    expect(out).toContain('New task')
    expect(out).toContain('Project')
    expect(out).toContain('Priority')
    expect(out).toContain('Finanzo')
    expect(out).toContain('+ New project')
    expect(out).toContain('Create task')
  })

  it('Life_HidesProjectAndPriority', () => {
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <PlannerNewEntryDialog
            visible
            projects={PROJECTS}
            onClose={() => {}}
            onSubmit={() => {}}
          />
        </ThemeProvider>,
      )
    })
    // Flip the Task/Life segmented control to "Life".
    const lifeSeg = r.root.find(
      n => n.props.accessibilityLabel === 'Life' && typeof n.props.onPress === 'function',
    )
    act(() => {
      lifeSeg.props.onPress()
    })
    const out = texts(r)
    expect(out).toContain('New life entry')
    expect(out).not.toContain('Priority')
    expect(out).toContain('Add to day')
  })

  it('Submit_EmitsTrimmedDraft', () => {
    const onSubmit = vi.fn<(d: NewEntryDraft) => void>()
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <PlannerNewEntryDialog
            visible
            projects={PROJECTS}
            onClose={() => {}}
            onSubmit={onSubmit}
          />
        </ThemeProvider>,
      )
    })
    // Type a title into the first text field.
    const inputs = r.root.findAll(n => typeof n.props.onChangeText === 'function')
    act(() => {
      inputs[0]?.props.onChangeText('  SEPA export  ')
    })
    // Press "Create task".
    const submitBtn = r.root
      .findAll(n => typeof n.props.onPress === 'function')
      .find(n =>
        n
          .findAll(c => typeof c.type === 'string')
          .flatMap(c => c.children)
          .includes('Create task'),
      )
    act(() => {
      submitBtn?.props.onPress()
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    const draft = onSubmit.mock.calls[0]?.[0]
    expect(draft?.title).toBe('SEPA export') // trimmed
    expect(draft?.isLife).toBe(false)
    expect(draft?.seriesKind).toBe('focus') // Task → focus series
    expect(draft?.estHours).toBe(1) // default effort
    expect(draft?.priority).toBe(2) // default Med
  })

  it('Meeting_EmitsAMeetingSeriesKind', () => {
    const onSubmit = vi.fn<(d: NewEntryDraft) => void>()
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <PlannerNewEntryDialog
            visible
            projects={PROJECTS}
            onClose={() => {}}
            onSubmit={onSubmit}
          />
        </ThemeProvider>,
      )
    })
    // Flip the type segmented control to "Meeting".
    const meetingSeg = r.root.find(
      n => n.props.accessibilityLabel === 'Meeting' && typeof n.props.onPress === 'function',
    )
    act(() => {
      meetingSeg.props.onPress()
    })
    const inputs = r.root.findAll(n => typeof n.props.onChangeText === 'function')
    act(() => {
      inputs[0]?.props.onChangeText('Sprint planning')
    })
    const submitBtn = r.root
      .findAll(n => typeof n.props.onPress === 'function')
      .find(n =>
        n
          .findAll(c => typeof c.type === 'string')
          .flatMap(c => c.children)
          .includes('Create meeting'),
      )
    act(() => {
      submitBtn?.props.onPress()
    })
    const draft = onSubmit.mock.calls[0]?.[0]
    expect(draft?.seriesKind).toBe('meeting')
    expect(draft?.isLife).toBe(false) // a meeting is still work time
  })

  it('Submit_BlockedWhenTitleEmpty', () => {
    const onSubmit = vi.fn<(d: NewEntryDraft) => void>()
    let r!: TestRenderer.ReactTestRenderer
    act(() => {
      r = TestRenderer.create(
        <ThemeProvider>
          <PlannerNewEntryDialog
            visible
            projects={PROJECTS}
            onClose={() => {}}
            onSubmit={onSubmit}
          />
        </ThemeProvider>,
      )
    })
    const submitBtn = r.root
      .findAll(n => typeof n.props.onPress === 'function')
      .find(n =>
        n
          .findAll(c => typeof c.type === 'string')
          .flatMap(c => c.children)
          .includes('Create task'),
      )
    act(() => {
      submitBtn?.props.onPress()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
