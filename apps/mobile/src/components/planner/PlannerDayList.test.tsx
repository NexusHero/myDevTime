import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { PlannerDayList, type DayListItem } from './PlannerDayList.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the classic day list (REQ-040): it lists the entries it is given,
 * sums their lengths into a deterministic day total, opens the drawer on tap (canvas parity), and
 * shows an honest empty state for an empty day.
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

const items: DayListItem[] = [
  {
    key: 'a',
    label: 'Sync engine',
    timeLabel: '09:00–10:30',
    lenMin: 90,
    color: '#1fa894',
    typeLabel: 'Booked time',
    onOpen: vi.fn(),
  },
  {
    key: 'b',
    label: 'Standup',
    timeLabel: '10:30–11:00',
    lenMin: 30,
    color: '#3e97dd',
    typeLabel: 'Meeting',
  },
]

describe('PlannerDayList', () => {
  it('ListsEntriesAndSumsTheDayTotal', () => {
    const out = texts(render(<PlannerDayList items={items} />))
    expect(out).toContain('Sync engine')
    expect(out).toContain('Standup')
    expect(out).toContain('Day total')
    // 90 + 30 = 120 min = 2:00 h (formatDuration renders H:MM).
    expect(out).toContain('2:00')
  })

  it('TappingARow_OpensItsDrawer', () => {
    const onOpen = vi.fn()
    const r = render(<PlannerDayList items={[{ ...items[0]!, onOpen }]} />)
    const row = r.root
      .findAllByType(Pressable)
      .find(p => String(p.props.accessibilityLabel).includes('Sync engine'))
    expect(row).toBeDefined()
    act(() => {
      row!.props.onPress()
    })
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('EmptyDay_ShowsAnHonestEmptyState', () => {
    const out = texts(render(<PlannerDayList items={[]} />))
    expect(out).toContain('Nothing booked yet')
  })
})
