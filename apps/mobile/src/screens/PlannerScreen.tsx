import { ScrollView, View } from 'react-native'
import { plannerBlockRect, plannerTotalHours, projectColor } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * Planner — the week view of day canvases (ux-vision §2.1/§3, issue #11). Plan
 * (dashed ghost blocks, Co-Planner proposals — REQ-031) and actuals (solid,
 * project-colored) share one surface per day, so drift is visible by *looking*;
 * an absence day shows the overlay instead. Block geometry comes from the pure,
 * tested `plannerBlockRect` (ADR-0005); project colors are deterministic per id.
 * Cross-day drag lands with the interaction spec in #39.
 */
interface Block {
  readonly day: number
  readonly start: number
  readonly len: number
  readonly label: string
  readonly project: string
  readonly ghost?: boolean
}

/** 08:00–18:00, in minutes from the top of the window. */
const SPAN = 10 * 60
const BODY_HEIGHT = 360
const COL_WIDTH = 148

const DAYS: readonly { label: string; today?: boolean; absence?: boolean }[] = [
  { label: 'Mon 7 Jul' },
  { label: 'Tue 8 Jul' },
  { label: 'Wed 9 Jul' },
  { label: 'Thu 10 Jul', today: true },
  { label: 'Fri 11 Jul', absence: true },
]

const BLOCKS: readonly Block[] = [
  { day: 0, start: 40, len: 90, label: 'Sync engine', project: 'sync-engine' },
  { day: 0, start: 150, len: 60, label: 'Finanzo API', project: 'finanzo' },
  { day: 0, start: 260, len: 120, label: 'Reviews', project: 'reviews' },
  { day: 0, start: 420, len: 90, label: 'Huber CMS', project: 'huber' },
  { day: 1, start: 30, len: 120, label: 'Timer module', project: 'sync-engine' },
  { day: 1, start: 180, len: 45, label: 'CI fix', project: 'reviews' },
  { day: 1, start: 260, len: 150, label: 'Finanzo auth', project: 'finanzo' },
  { day: 2, start: 60, len: 60, label: 'Huber call', project: 'huber' },
  { day: 2, start: 140, len: 120, label: 'Canvas UI', project: 'sync-engine' },
  { day: 2, start: 300, len: 90, label: 'Finanzo docs', project: 'finanzo' },
  { day: 2, start: 430, len: 60, label: 'OSS PR', project: 'nordwind' },
  { day: 3, start: 8, len: 48, label: 'Review #218', project: 'reviews' },
  { day: 3, start: 78, len: 90, label: 'Conflict tests', project: 'sync-engine' },
  { day: 3, start: 190, len: 40, label: 'Angebot', project: 'huber' },
  { day: 3, start: 273, len: 65, label: 'Tombstones', project: 'sync-engine', ghost: true },
  { day: 3, start: 420, len: 60, label: 'Sprint review', project: 'finanzo' },
  { day: 3, start: 490, len: 50, label: 'Docs REQ-025', project: 'reviews', ghost: true },
]

function dayTotalHours(day: number): number {
  return plannerTotalHours(BLOCKS.filter(b => b.day === day && !b.ghost).map(b => b.len))
}

export function PlannerScreen(): React.JSX.Element {
  const t = useTheme()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}
    >
      <View>
        <Text
          style={{
            fontWeight: '700',
            fontSize: t.fontSize.xl,
            color: t.color.ink,
            fontFamily: t.fontFamily.display,
          }}
        >
          Planner
        </Text>
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2, marginTop: 2 }}>
          Week 28 · plan (dashed) and actuals on one surface
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.spacing.s3, paddingBottom: t.spacing.s2 }}
      >
        {DAYS.map((day, di) => (
          <View
            key={day.label}
            style={{
              width: COL_WIDTH,
              borderRadius: t.radius.card,
              borderWidth: 1,
              borderColor: day.today ? t.color.accent : t.color.border,
              backgroundColor: t.color.surface,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: t.spacing.s3,
                paddingVertical: t.spacing.s2,
                borderBottomWidth: 1,
                borderBottomColor: t.color.border,
              }}
            >
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  fontWeight: '600',
                  color: day.today ? t.color.accent : t.color.ink,
                }}
              >
                {day.label}
              </Text>
              {day.absence ? null : (
                <Text
                  style={{
                    fontSize: t.fontSize.xs,
                    color: t.color.ink2,
                    fontFamily: t.fontFamily.numeric,
                  }}
                >
                  {dayTotalHours(di).toFixed(1)}h
                </Text>
              )}
            </View>

            <View style={{ height: BODY_HEIGHT, position: 'relative' }}>
              {day.absence ? (
                <View
                  style={{
                    ...absoluteFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: t.spacing.s2,
                    borderRadius: t.radius.chip,
                    borderWidth: 1,
                    borderColor: `${t.color.good}55`,
                    backgroundColor: `${t.color.good}1a`,
                  }}
                >
                  <Badge tone="good">Vacation</Badge>
                  <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 6 }}>
                    all day
                  </Text>
                </View>
              ) : (
                BLOCKS.filter(b => b.day === di).map((b, i) => {
                  const rect = plannerBlockRect(b.start, b.len, SPAN)
                  const color = projectColor(b.project, t.mode)
                  return (
                    <View
                      key={`${b.label}-${String(i)}`}
                      style={{
                        position: 'absolute',
                        left: t.spacing.s2,
                        right: t.spacing.s2,
                        top: rect.top * BODY_HEIGHT,
                        height: Math.max(rect.height * BODY_HEIGHT, 16),
                        borderRadius: t.radius.chip,
                        paddingHorizontal: t.spacing.s2,
                        justifyContent: 'center',
                        borderLeftWidth: b.ghost ? 0 : 3,
                        borderLeftColor: color,
                        borderWidth: b.ghost ? 1 : 0,
                        borderColor: color,
                        borderStyle: b.ghost ? 'dashed' : 'solid',
                        backgroundColor: b.ghost ? `${color}14` : `${color}26`,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: t.fontSize.xs,
                          color: t.color.ink,
                          fontWeight: b.ghost ? '500' : '600',
                          fontStyle: b.ghost ? 'italic' : 'normal',
                        }}
                      >
                        {b.ghost ? `◇ ${b.label}` : b.label}
                      </Text>
                    </View>
                  )
                })
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, lineHeight: 18 }}>
        Dashed blocks are Co-Planner proposals — one tap accepts, swipe dismisses; the green overlay
        is an absence. Cross-day drag arrives with the interaction spec (#39).
      </Text>
    </ScrollView>
  )
}

const absoluteFill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const
