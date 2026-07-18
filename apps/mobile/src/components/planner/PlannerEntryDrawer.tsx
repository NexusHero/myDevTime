import { useState } from 'react'
import { Pressable, View, useWindowDimensions } from 'react-native'
import type { RecurrenceRule } from '@mydevtime/domain'
import { Text } from '../core/Text'
import { Badge, Button, Icon, IconButton, Input, SegmentedControl, Switch } from '../index'
import { RecurrenceEditor } from './RecurrenceEditor'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * The typed Planner entry drawer (ADR-0063, backlog H2). Clicking a calendar block
 * opens this right sheet, typed by what the block *is* — so a meeting, a booked task,
 * a Co-Planner ghost and a break each get their own controls without a separate tab.
 * This is the mechanism that folds the old Meetings/Absence surfaces into the calendar:
 * the block is the entry, the drawer is its detail. Presentation only — every action is
 * a callback the Planner wires to its real state (RSVP, delete, start timer, accept/
 * dismiss a proposal); the drawer invents no data (ADR-0005).
 *
 * The block model today carries four kinds (meeting · actual/booked · ghost · break);
 * Absence and Event join as first-class kinds when the canvas gains them.
 */
export type EntryKind = 'meeting' | 'actual' | 'ghost' | 'break' | 'life' | 'travel'
export type EntryRsvp = 'accepted' | 'tentative' | 'fyi'

/** A resolved view-model of the tapped block — the Planner builds this from its own
 *  `CanvasBlock`, keeping the drawer decoupled from the screen's internals. */
export interface DrawerEntry {
  readonly kind: EntryKind
  readonly title: string
  /** Pre-formatted span, e.g. `09:00–10:30`. */
  readonly timeLabel: string
  /** Resolved color (project color, or a neutral for breaks). */
  readonly color: string
  readonly rsvp?: EntryRsvp
  /** External source label, e.g. `Outlook`. */
  readonly ext?: string
  readonly rec?: boolean
  /** Whether the 🛡 protection flag is on (design v14 D14). */
  readonly protected?: boolean
  /** Travel (design v20 §G4): the trip's start place, e.g. `Office`. */
  readonly routeFrom?: string
  /** Travel: the trip's destination, e.g. `Client site`. */
  readonly routeTo?: string
  /** Travel: the user-entered one-way distance in km (never inferred — ADR-0005). */
  readonly distanceKm?: number | null
}

const KIND_LABEL: Record<EntryKind, string> = {
  meeting: 'Meeting',
  actual: 'Booked time',
  ghost: 'Proposed',
  break: 'Break',
  // Life/personal (design v14 §F) — family is not a project; it only reduces plannable
  // capacity. Editing/creating a life block lands with the deferred `life` persistence.
  life: 'Life',
  // Travel (design v20 §G4) — a trip between places; the route/mileage detail is a follow-up.
  travel: 'Travel',
}

const RSVP_SEGMENTS: readonly { readonly value: EntryRsvp; readonly label: string }[] = [
  { value: 'accepted', label: 'Going' },
  { value: 'tentative', label: 'Tentative' },
  { value: 'fyi', label: 'FYI' },
]

export interface PlannerEntryDrawerProps {
  /** The tapped entry, or null to render nothing (closed). */
  readonly entry: DrawerEntry | null
  readonly onClose: () => void
  /** Meeting: change attendance. */
  readonly onRsvp?: (rsvp: EntryRsvp) => void
  /** Booked time: start a timer on it. */
  readonly onStartTimer?: () => void
  /** Booked time: delete it (with the caller's undo). */
  readonly onDelete?: () => void
  /** Shift the block's start by ±15 min (design v20 drawer). */
  readonly onNudge?: (deltaMin: number) => void
  /** Duplicate the block on the same day (design v20 drawer). */
  readonly onDuplicate?: () => void
  /** Travel (design v20 §G4): save the entered route + distance onto the trip. */
  readonly onTravelDetail?: (detail: { from: string; to: string; km: number | null }) => void
  /** Ghost: accept the Co-Planner proposal. */
  readonly onAccept?: () => void
  /** Ghost: dismiss the proposal. */
  readonly onDismiss?: () => void
  /** Toggle the 🛡 protection flag (D14). When set, the row is shown for the entry. */
  readonly onProtect?: (next: boolean) => void
  /** Make this entry a recurring series (design v17 §F4). When set, the ↻ editor is shown. */
  readonly onRecurrence?: (rule: RecurrenceRule) => void
}

export function PlannerEntryDrawer({
  entry,
  onClose,
  onRsvp,
  onStartTimer,
  onDelete,
  onNudge,
  onDuplicate,
  onTravelDetail,
  onAccept,
  onDismiss,
  onProtect,
  onRecurrence,
}: PlannerEntryDrawerProps): React.JSX.Element | null {
  const t = useTheme()
  const { width } = useWindowDimensions()
  // The in-progress recurrence rule for the ↻ editor; the Planner persists it on save.
  const [rule, setRule] = useState<RecurrenceRule>({ freq: 'none', end: { kind: 'never' } })
  // Travel route draft (design v20 §G4). Seeded from the entry; distance stays a raw string so a
  // half-typed number never coerces — it is parsed only on save, and only the user ever enters it.
  const [routeFrom, setRouteFrom] = useState(entry?.routeFrom ?? '')
  const [routeTo, setRouteTo] = useState(entry?.routeTo ?? '')
  const [distance, setDistance] = useState(
    entry?.distanceKm != null ? String(entry.distanceKm) : '',
  )
  if (entry === null) return null

  const panelWidth = Math.min(380, width - 24)

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 200 }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close entry"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          bottom: 12,
          width: panelWidth,
          backgroundColor: t.color.bg,
          borderWidth: 1,
          borderColor: t.color.border,
          borderRadius: 16,
          overflow: 'hidden',
          elevation: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s3,
            paddingHorizontal: t.spacing.s5,
            paddingVertical: t.spacing.s4,
            borderBottomWidth: 1,
            borderBottomColor: t.color.border,
          }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: entry.color,
            }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: t.fontSize['2xs'],
              fontWeight: '700',
              letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
              textTransform: 'uppercase',
              color: t.color.ink3,
            }}
          >
            {KIND_LABEL[entry.kind]}
          </Text>
          <IconButton icon={<Icon name="x" size={18} />} label="Close entry" onPress={onClose} />
        </View>

        <View style={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
          <View style={{ gap: t.spacing.s2 }}>
            <Text
              style={{
                fontSize: t.fontSize.lg,
                fontWeight: '700',
                color: t.color.ink,
                fontFamily: t.fontFamily.display,
              }}
            >
              {entry.kind === 'ghost' ? `◇ ${entry.title}` : entry.title}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
              <Text style={{ fontFamily: t.fontFamily.numeric, color: t.color.ink2 }}>
                {entry.timeLabel}
              </Text>
              {entry.rec === true && <Badge tone="neutral">↻ Recurring</Badge>}
              {entry.ext !== undefined && <Badge tone="neutral">{`⇄ ${entry.ext}`}</Badge>}
            </View>
          </View>

          {entry.kind === 'meeting' && (
            <View style={{ gap: t.spacing.s3 }}>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Attendance</Text>
              <SegmentedControl
                segments={RSVP_SEGMENTS}
                active={entry.rsvp ?? 'accepted'}
                onChange={rsvp => onRsvp?.(rsvp)}
              />
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, lineHeight: 16 }}>
                Transcript & AI notes appear here once the meeting is captured — capture needs your
                explicit consent (REQ-025).
              </Text>
            </View>
          )}

          {entry.kind === 'actual' && (
            <View style={{ gap: t.spacing.s2 }}>
              {onNudge !== undefined && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                  <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Nudge</Text>
                  <Button size="sm" variant="ghost" onPress={() => onNudge(-15)}>
                    −15 min
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => onNudge(15)}>
                    +15 min
                  </Button>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                {onStartTimer !== undefined && (
                  <Button size="sm" onPress={onStartTimer}>
                    Start timer
                  </Button>
                )}
                {onDuplicate !== undefined && (
                  <Button size="sm" variant="ghost" onPress={onDuplicate}>
                    Duplicate
                  </Button>
                )}
                {onDelete !== undefined && (
                  <Button size="sm" variant="ghost" onPress={onDelete}>
                    Delete
                  </Button>
                )}
              </View>
            </View>
          )}

          {entry.kind === 'ghost' && (
            <View style={{ gap: t.spacing.s3 }}>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, lineHeight: 16 }}>
                ✦ Co-Planner proposal — a suggestion from your own plan, not a booked entry. You
                decide.
              </Text>
              <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
                {onAccept !== undefined && (
                  <Button size="sm" onPress={onAccept}>
                    Accept
                  </Button>
                )}
                {onDismiss !== undefined && (
                  <Button size="sm" variant="ghost" onPress={onDismiss}>
                    Dismiss
                  </Button>
                )}
              </View>
            </View>
          )}

          {entry.kind === 'break' && (
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, lineHeight: 18 }}>
              A break — counts toward your daily break target, not billable time.
            </Text>
          )}

          {/* Travel route card (design v20 §G4): a trip's From → To and distance. The distance is
              yours to enter — we never infer a number that could reach a report (ADR-0005). Saving
              hands the route back to the Planner, which persists it and titles the block. */}
          {entry.kind === 'travel' && onTravelDetail !== undefined && (
            <View style={{ gap: t.spacing.s3 }}>
              <Input
                label="From"
                placeholder="e.g. Office"
                value={routeFrom}
                onChangeText={setRouteFrom}
              />
              <Input
                label="To"
                placeholder="e.g. Client site"
                value={routeTo}
                onChangeText={setRouteTo}
              />
              <Input
                label="Distance (km)"
                placeholder="one-way, e.g. 42"
                value={distance}
                onChangeText={setDistance}
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row' }}>
                <Button
                  size="sm"
                  onPress={() => {
                    const parsed = Number.parseFloat(distance.replace(',', '.'))
                    onTravelDetail({
                      from: routeFrom.trim(),
                      to: routeTo.trim(),
                      km: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                    })
                  }}
                >
                  Save route
                </Button>
              </View>
            </View>
          )}

          {/* Protection flag (design v14 D14): a flag on this existing entry that governs
              communication only — it mutes your own nudges and reports "Busy" to Outlook,
              never touching the timer or punch clock. */}
          {onProtect !== undefined && (
            <View
              style={{
                gap: t.spacing.s2,
                borderTopWidth: 1,
                borderTopColor: t.color.border,
                paddingTop: t.spacing.s3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <Icon name="shield" size={16} color={t.color.ink2} />
                <View style={{ flex: 1 }}>
                  <Switch
                    label="Protected"
                    accessibilityLabel="Protected"
                    checked={entry.protected === true}
                    onChange={next => onProtect(next)}
                  />
                </View>
              </View>
              <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, lineHeight: 16 }}>
                Mutes your own nudges and shows you as Busy — communication only, never your time
                tracking. You are asked once, never punched out automatically.
              </Text>
            </View>
          )}

          {/* Recurrence (design v17 §F4): make this entry a series — a rule (frequency + end)
              that repeats across days. Series are a core feature for every entry kind, not a
              family extra. The occurrence math is deterministic (ADR-0005); this only captures
              the rule and hands it to the Planner to persist. */}
          {onRecurrence !== undefined && entry.kind !== 'ghost' && entry.kind !== 'break' && (
            <View
              style={{
                gap: t.spacing.s2,
                borderTopWidth: 1,
                borderTopColor: t.color.border,
                paddingTop: t.spacing.s3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>↻</Text>
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}>
                  Repeat
                </Text>
              </View>
              <RecurrenceEditor value={rule} onChange={setRule} />
              <View style={{ flexDirection: 'row' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={rule.freq === 'none'}
                  onPress={() => onRecurrence(rule)}
                >
                  Make recurring
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}
