import { Pressable, View, useWindowDimensions } from 'react-native'
import { Text } from '../core/Text'
import { Badge, Button, Icon, IconButton, SegmentedControl } from '../index'
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
export type EntryKind = 'meeting' | 'actual' | 'ghost' | 'break'
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
}

const KIND_LABEL: Record<EntryKind, string> = {
  meeting: 'Meeting',
  actual: 'Booked time',
  ghost: 'Proposed',
  break: 'Break',
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
  /** Ghost: accept the Co-Planner proposal. */
  readonly onAccept?: () => void
  /** Ghost: dismiss the proposal. */
  readonly onDismiss?: () => void
}

export function PlannerEntryDrawer({
  entry,
  onClose,
  onRsvp,
  onStartTimer,
  onDelete,
  onAccept,
  onDismiss,
}: PlannerEntryDrawerProps): React.JSX.Element | null {
  const t = useTheme()
  const { width } = useWindowDimensions()
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
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              {onStartTimer !== undefined && (
                <Button size="sm" onPress={onStartTimer}>
                  Start timer
                </Button>
              )}
              {onDelete !== undefined && (
                <Button size="sm" variant="ghost" onPress={onDelete}>
                  Delete
                </Button>
              )}
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
        </View>
      </View>
    </View>
  )
}
