// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import TestRenderer from 'react-test-renderer'
import { Pressable } from 'react-native'
import { PlannerEntryDrawer, type DrawerEntry } from './PlannerEntryDrawer.js'
import { ThemeProvider } from '../../theme/ThemeProvider.js'

/**
 * Render tests (ADR-0027) for the typed Planner entry drawer (ADR-0063, H2): it is
 * absent when nothing is selected, and each kind exposes its own controls, each wired
 * to a callback (the Planner does the real mutation).
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

function pressByLabel(r: TestRenderer.ReactTestRenderer, label: string): void {
  const p = r.root.findAllByType(Pressable).find(x => x.props.accessibilityLabel === label)
  expect(p, `pressable "${label}"`).toBeDefined()
  act(() => {
    p!.props.onPress()
  })
}

const meeting: DrawerEntry = {
  kind: 'meeting',
  title: 'Sprint planning',
  timeLabel: '09:00–10:00',
  color: '#3e97dd',
  rsvp: 'accepted',
  ext: 'Outlook',
  rec: true,
}

describe('PlannerEntryDrawer', () => {
  it('PlannerEntryDrawer_noSelection_rendersNothing', () => {
    const r = render(<PlannerEntryDrawer entry={null} onClose={() => {}} />)
    expect(r.toJSON()).toBeNull()
  })

  it('PlannerEntryDrawer_meeting_showsAttendanceAndChangesRsvp', () => {
    const onRsvp = vi.fn()
    const r = render(<PlannerEntryDrawer entry={meeting} onClose={() => {}} onRsvp={onRsvp} />)
    const all = texts(r)
    expect(all).toContain('Meeting')
    expect(all).toContain('Sprint planning')
    expect(all).toContain('Attendance')
    // The RSVP segments carry their labels as accessibility labels.
    pressByLabel(r, 'Tentative')
    expect(onRsvp).toHaveBeenCalledWith('tentative')
  })

  it('PlannerEntryDrawer_actual_offersDelete', () => {
    const onDelete = vi.fn()
    const entry: DrawerEntry = {
      kind: 'actual',
      title: 'Finanzo · API',
      timeLabel: '11:00–12:30',
      color: '#1fa894',
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={() => {}} onDelete={onDelete} />)
    expect(texts(r)).toContain('Booked time')
    pressByLabel(r, 'Delete')
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('PlannerEntryDrawer_travel_savesTheEnteredRoute_G4', () => {
    const onTravelDetail = vi.fn()
    const entry: DrawerEntry = {
      kind: 'travel',
      title: 'Trip',
      timeLabel: '08:00–09:00',
      color: '#e8a33d',
      routeFrom: 'Office',
      routeTo: 'Client site',
      distanceKm: 42,
    }
    const r = render(
      <PlannerEntryDrawer entry={entry} onClose={() => {}} onTravelDetail={onTravelDetail} />,
    )
    expect(texts(r)).toContain('Travel')
    // The seeded route + distance read back, and saving hands the parsed values to the Planner —
    // the km is exactly what was entered, never inferred (ADR-0005).
    pressByLabel(r, 'Save route')
    expect(onTravelDetail).toHaveBeenCalledWith({
      from: 'Office',
      to: 'Client site',
      km: 42,
      mode: 'car',
    })
  })

  it('PlannerEntryDrawer_protectToggle_firesOnProtect_D14', () => {
    const onProtect = vi.fn()
    const entry: DrawerEntry = {
      kind: 'actual',
      title: 'Finanzo · API',
      timeLabel: '11:00–12:30',
      color: '#1fa894',
      protected: false,
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={() => {}} onProtect={onProtect} />)
    // No 🛡 emoji in the UI (design v17 icon rule) — a stroke-shield Icon + plain "Protected".
    expect(texts(r)).toContain('Protected')
    expect(texts(r)).not.toContain('🛡')
    pressByLabel(r, 'Protected, off')
    expect(onProtect).toHaveBeenCalledWith(true)
  })

  it('PlannerEntryDrawer_noOnProtect_hidesTheProtectionRow', () => {
    const entry: DrawerEntry = {
      kind: 'break',
      title: 'Lunch',
      timeLabel: '12:30–13:00',
      color: '#7c8698',
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={() => {}} />)
    expect(texts(r)).not.toContain('Protected')
  })

  it('PlannerEntryDrawer_recurrence_makesTheEntryASeries_F4', () => {
    const onRecurrence = vi.fn()
    const entry: DrawerEntry = {
      kind: 'actual',
      title: 'Standup',
      timeLabel: '09:00–09:30',
      color: '#1fa894',
    }
    const r = render(
      <PlannerEntryDrawer entry={entry} onClose={() => {}} onRecurrence={onRecurrence} />,
    )
    expect(texts(r)).toContain('Repeat')
    // Default is "Once" → nothing to persist; choosing Weekly then "Make recurring" fires the rule.
    pressByLabel(r, 'Weekly')
    pressByLabel(r, 'Make recurring')
    expect(onRecurrence).toHaveBeenCalledWith({ freq: 'weekly', end: { kind: 'never' } })
  })

  it('PlannerEntryDrawer_noOnRecurrence_hidesTheRepeatSection', () => {
    const entry: DrawerEntry = {
      kind: 'break',
      title: 'Lunch',
      timeLabel: '12:30–13:00',
      color: '#7c8698',
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={() => {}} />)
    expect(texts(r)).not.toContain('Repeat')
  })

  it('PlannerEntryDrawer_ghost_acceptsTheProposal', () => {
    const onAccept = vi.fn()
    const entry: DrawerEntry = {
      kind: 'ghost',
      title: 'DEV-42 · Refactor',
      timeLabel: '14:00–15:00',
      color: '#8b7bf5',
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={() => {}} onAccept={onAccept} />)
    expect(texts(r)).toContain('Proposed')
    pressByLabel(r, 'Accept')
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('PlannerEntryDrawer_scrimCloses', () => {
    const onClose = vi.fn()
    const entry: DrawerEntry = {
      kind: 'break',
      title: 'Lunch',
      timeLabel: '12:30–13:00',
      color: '#7c8698',
    }
    const r = render(<PlannerEntryDrawer entry={entry} onClose={onClose} />)
    pressByLabel(r, 'Close entry')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

/**
 * Presentation modes (issue #370). On a wide viewport the detail is a **docked column** beside the
 * calendar: no scrim, not a modal, so the canvas next to it stays visible and clickable — the
 * master–detail shape `chromeForWidth().splitView` already promises. Narrow viewports keep the
 * overlay sheet, which must stay modal so focus and the backdrop-tap still behave.
 */
describe('PlannerEntryDrawer · presentation mode', () => {
  const entry: DrawerEntry = {
    kind: 'meeting',
    title: 'Sprint planning',
    timeLabel: '09:00–10:00',
    color: '#8b7bf5',
  }

  function closers(r: TestRenderer.ReactTestRenderer): unknown[] {
    return r.root.findAllByType(Pressable).filter(p => p.props.accessibilityLabel === 'Close entry')
  }

  it('Overlay_KeepsTheScrimAndStaysModal', () => {
    const r = render(
      <PlannerEntryDrawer
        entry={entry}
        panel={{ mode: 'overlay', width: 320 }}
        onClose={() => undefined}
      />,
    )
    // Two closers: the backdrop scrim and the header button.
    expect(closers(r)).toHaveLength(2)
    expect(r.root.findAll(n => n.props.accessibilityViewIsModal === true).length).toBeGreaterThan(0)
  })

  it('Docked_DropsTheScrimAndIsNotModal', () => {
    const r = render(
      <PlannerEntryDrawer
        entry={entry}
        panel={{ mode: 'docked', width: 340 }}
        onClose={() => undefined}
      />,
    )
    // Only the header button — no backdrop, because the calendar beside it must stay usable.
    expect(closers(r)).toHaveLength(1)
    expect(r.root.findAll(n => n.props.accessibilityViewIsModal === true)).toHaveLength(0)
    expect(texts(r)).toContain('Sprint planning')
  })

  it('Docked_TakesTheGivenColumnWidthInFlow', () => {
    const r = render(
      <PlannerEntryDrawer
        entry={entry}
        panel={{ mode: 'docked', width: 340 }}
        onClose={() => undefined}
      />,
    )
    const panel = r.root.find(n => n.props.tabIndex === -1)
    const style = panel.props.style as { width?: number; position?: string }
    expect(style.width).toBe(340)
    // In flow, not floating over the canvas — that is what makes it a real column.
    expect(style.position).not.toBe('absolute')
  })

  it('ClosedRendersNothingInEitherMode', () => {
    const r = render(
      <PlannerEntryDrawer
        entry={null}
        panel={{ mode: 'docked', width: 340 }}
        onClose={() => undefined}
      />,
    )
    expect(r.toJSON()).toBeNull()
  })
})

/**
 * Depth per kind (issue #372). A task's detail was only a title and a span — the two things a
 * person actually asks ("what is this?" and "how much is it?") were missing, even though the
 * occurrence carries a description and the block knows its own length.
 */
describe('PlannerEntryDrawer · description and effort', () => {
  const base: DrawerEntry = {
    kind: 'actual',
    title: 'Sync engine',
    timeLabel: '09:00–11:00',
    color: '#8b7bf5',
  }

  it('ShowsTheDescriptionWhenTheEntryHasOne', () => {
    const r = render(
      <PlannerEntryDrawer
        entry={{ ...base, note: 'Ports first, then the adapter.' }}
        onClose={() => undefined}
      />,
    )
    expect(texts(r)).toContain('Ports first, then the adapter.')
  })

  it('SaysNothingAtAllWhenThereIsNoDescription', () => {
    // An honest empty state is silence, not a "no description" placeholder.
    const out = texts(render(<PlannerEntryDrawer entry={base} onClose={() => undefined} />))
    expect(out).not.toContain('Description')
  })

  it('ShowsTheEffortAsAReadableDuration', () => {
    const out = texts(
      render(<PlannerEntryDrawer entry={{ ...base, plannedMin: 150 }} onClose={() => undefined} />),
    )
    expect(out).toContain('Effort')
    expect(out).toContain('2:30 h')
  })

  it('OmitsEffortWhenTheEntryCarriesNoLength', () => {
    expect(
      texts(render(<PlannerEntryDrawer entry={base} onClose={() => undefined} />)),
    ).not.toContain('Effort')
  })
})

/**
 * Travel route read-out (issue #374, design v20 §G4). The travel detail was a bare form — two
 * text inputs and a km field, showing the user what they typed back at them. What a trip *is*
 * — the route, its mode, and the worktime it actually earns — was nowhere, even though
 * `@mydevtime/domain` prices a leg deterministically. The read-out leads; the form stays below it.
 */
describe('PlannerEntryDrawer · travel route', () => {
  const trip: DrawerEntry = {
    kind: 'travel',
    title: 'Trip',
    timeLabel: '08:00–09:00',
    color: '#e8a33d',
    routeFrom: 'Office',
    routeTo: 'Client site',
    distanceKm: 42,
    plannedMin: 60,
  }

  it('ShowsTheRouteAndDistanceAsAReadOut_notOnlyAsInputs', () => {
    const out = texts(render(<PlannerEntryDrawer entry={trip} onClose={() => undefined} />))
    expect(out).toContain('Office → Client site')
    expect(out).toContain('42 km')
  })

  it('CreditsACarTripAtTheReducedFraction', () => {
    // The policy bills car travel time at 50 % — an hour of driving credits half an hour.
    // The number comes from the domain (ADR-0005), never from the view.
    const out = texts(
      render(
        <PlannerEntryDrawer entry={{ ...trip, travelMode: 'car' }} onClose={() => undefined} />,
      ),
    )
    expect(out).toContain('Worktime credited')
    expect(out).toContain('0:30 h')
  })

  it('CreditsATrainTripAsFullWorktime', () => {
    // You can work on a train, so the reduced fraction does not apply.
    const out = texts(
      render(
        <PlannerEntryDrawer entry={{ ...trip, travelMode: 'train' }} onClose={() => undefined} />,
      ),
    )
    expect(out).toContain('1:00 h')
  })

  it('SaysNothingAboutTheRouteWhenNeitherPlaceIsKnown', () => {
    // An honest empty state is silence — never a "→" with nothing on either side of it.
    const out = texts(
      render(
        <PlannerEntryDrawer
          entry={{ kind: 'travel', title: 'Trip', timeLabel: '08:00–09:00', color: '#e8a33d' }}
          onClose={() => undefined}
        />,
      ),
    )
    expect(out).not.toContain('→')
    expect(out).not.toContain('Worktime credited')
  })

  it('SavesTheChosenModeAlongWithTheRoute', () => {
    // Mode is not cosmetic — it decides the worktime fraction, so it must be the user's choice
    // and travel with the route when it is saved.
    const onTravelDetail = vi.fn()
    const r = render(
      <PlannerEntryDrawer entry={trip} onClose={() => undefined} onTravelDetail={onTravelDetail} />,
    )
    pressByLabel(r, 'Train')
    pressByLabel(r, 'Save route')
    expect(onTravelDetail).toHaveBeenCalledWith({
      from: 'Office',
      to: 'Client site',
      km: 42,
      mode: 'train',
    })
  })

  it('ShowsTheReadOutEvenWithoutAnEditHandler', () => {
    // A read-only travel entry (a Month chip, a series occurrence) still says what the trip is;
    // only the form below it needs `onTravelDetail`.
    const out = texts(render(<PlannerEntryDrawer entry={trip} onClose={() => undefined} />))
    expect(out).toContain('Office → Client site')
  })
})

/**
 * Meeting detail (issue #375). A meeting's detail showed a title, a span and an RSVP control —
 * none of the three things that make a meeting a meeting: where it is, who is in it, and how to
 * join it. Each appears only when the entry actually carries it.
 */
describe('PlannerEntryDrawer · meeting detail', () => {
  const base: DrawerEntry = {
    kind: 'meeting',
    title: 'Sprint planning',
    timeLabel: '09:00–10:00',
    color: '#3e97dd',
  }

  it('ShowsTheLocationWhenTheMeetingHasOne', () => {
    const out = texts(
      render(
        <PlannerEntryDrawer entry={{ ...base, location: 'Room 3 · Berlin' }} onClose={() => {}} />,
      ),
    )
    expect(out).toContain('Room 3 · Berlin')
  })

  it('ListsAttendeesWithTheirResponse', () => {
    const out = texts(
      render(
        <PlannerEntryDrawer
          entry={{
            ...base,
            attendees: [
              { name: 'Ada', response: 'accepted' },
              { name: 'Grace', response: 'declined' },
              { name: 'Alan' },
            ],
          }}
          onClose={() => {}}
        />,
      ),
    )
    expect(out).toContain('Ada')
    expect(out).toContain('Grace')
    expect(out).toContain('Alan')
    // The response is stated in words — a screen reader must hear it, not infer it from a colour.
    expect(out).toContain('Declined')
  })

  it('SaysNothingWhenThereAreNoAttendees', () => {
    // An empty list is silence, not "0 attendees".
    expect(texts(render(<PlannerEntryDrawer entry={base} onClose={() => {}} />))).not.toContain(
      'Attendees',
    )
  })

  it('OffersAJoinActionForAConferenceLink', () => {
    const onJoin = vi.fn()
    const r = render(
      <PlannerEntryDrawer
        entry={{
          ...base,
          conferenceUrl: 'https://meet.example.com/abc',
          conferenceProvider: 'Meet',
        }}
        onClose={() => {}}
        onJoin={onJoin}
      />,
    )
    expect(texts(r)).toContain('Meet')
    pressByLabel(r, 'Join Meet')
    expect(onJoin).toHaveBeenCalledWith('https://meet.example.com/abc')
  })

  it('ShowsNoJoinActionWithoutALink', () => {
    expect(
      texts(render(<PlannerEntryDrawer entry={base} onClose={() => {}} onJoin={() => {}} />)),
    ).not.toContain('Join')
  })
})
