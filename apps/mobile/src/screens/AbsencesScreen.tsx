import { View } from 'react-native'
import { monthGrid, weekdayHeaders } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Card, EmptyState, LeaveBalance, Row, ScreenScaffold } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'
import { useAbsences } from '../hooks/useAbsences'
import type { Absence, AbsenceKind } from '../api/absences'

/**
 * Absences (#37, REQ-029, ux-vision §3) — the vacation / sick / public-holiday
 * calendar the Profile hub links into. The month grid comes from the pure, tested
 * `monthGrid` helper; the day markers, the remaining-days balance, and the
 * upcoming list are fed by the `absences` module (`useAbsences`) — the balance is
 * the deterministic core's (ADR-0005). Loading and error states are surfaced; with
 * no backend the calendar is simply empty.
 */
function kindColor(kind: AbsenceKind, t: ReturnType<typeof useTheme>): string {
  if (kind === 'vacation') return t.color.good
  if (kind === 'sick') return t.color.warn
  if (kind === 'holiday') return t.color.accent
  return t.color.ink2
}

const KIND_LABEL: Record<AbsenceKind, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  holiday: 'Holiday',
  other: 'Other',
}

/** A concise range label, e.g. `Jul 14 – 17` or `Jul 29`. */
const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
function rangeLabel(a: Absence): string {
  const [, sm, sd] = a.startDate.split('-')
  const [, em, ed] = a.endDate.split('-')
  const start = `${MONTH_ABBR[Number(sm) - 1] ?? ''} ${Number(sd)}`
  if (a.startDate === a.endDate) return start
  const end = sm === em ? String(Number(ed)) : `${MONTH_ABBR[Number(em) - 1] ?? ''} ${Number(ed)}`
  return `${start} – ${end}`
}

export function AbsencesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const { data, loading, error } = useAbsences()

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s2 }}>
      <View style={{ flex: 1 }}>
        <SubScreenHeader
          title="Absences"
          subtitle="Vacation, sick days & public holidays"
          onBack={onBack}
        />
      </View>
    </View>
  )

  if (data === null) {
    return (
      <ScreenScaffold header={header}>
        <Card>
          {error ? (
            <Text style={{ color: t.color.crit }}>Couldn’t load absences — {error.message}</Text>
          ) : loading ? (
            <Text style={{ color: t.color.ink2 }}>Loading absences…</Text>
          ) : (
            <EmptyState
              title="No absences yet"
              hint="Book vacation or sick days to see them here."
            />
          )}
        </Card>
      </ScreenScaffold>
    )
  }

  const { month, marks, balance, upcoming } = data

  const weeks = monthGrid(month.year, month.month0, true)
  const headers = weekdayHeaders(true)

  return (
    <ScreenScaffold header={header}>
      <Card>
        <LeaveBalance
          entitlement={balance.allowanceDays}
          taken={balance.usedDays}
          carryover={balance.carryOverDays}
        />
      </Card>

      <Card title={month.label}>
        <View style={{ flexDirection: 'row' }}>
          {headers.map(h => (
            <Text
              key={h}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: t.fontSize.xs,
                color: t.color.ink3,
                fontWeight: '600',
                marginBottom: t.spacing.s2,
              }}
            >
              {h}
            </Text>
          ))}
        </View>
        <View style={{ gap: 4 }}>
          {weeks.map((week, wi) => (
            <View key={`w${String(wi)}`} style={{ flexDirection: 'row', gap: 4 }}>
              {week.map((cell, ci) => {
                const mark = cell.inMonth ? marks[cell.date] : undefined
                const isToday = cell.inMonth && cell.date === month.today
                const bg = mark ? `${kindColor(mark, t)}2b` : 'transparent'
                return (
                  <View
                    key={`c${String(wi)}-${String(ci)}`}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: t.radius.chip,
                      backgroundColor: bg,
                      borderWidth: isToday ? 1 : 0,
                      borderColor: t.color.accent,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: t.fontFamily.numeric,
                        fontSize: t.fontSize.xs,
                        color: !cell.inMonth
                          ? t.color.ink3
                          : mark
                            ? kindColor(mark, t)
                            : t.color.ink,
                        fontWeight: mark || isToday ? '700' : '400',
                        opacity: cell.inMonth ? 1 : 0.4,
                      }}
                    >
                      {String(cell.date)}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: t.spacing.s3,
            marginTop: t.spacing.s4,
          }}
        >
          {(['vacation', 'sick', 'holiday'] as const).map(kind => (
            <View
              key={kind}
              style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: `${kindColor(kind, t)}2b`,
                  borderWidth: 1,
                  borderColor: kindColor(kind, t),
                }}
              />
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                {KIND_LABEL[kind]}
              </Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: t.color.accent,
              }}
            />
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Today</Text>
          </View>
        </View>
      </Card>

      <View>
        <Text
          style={{
            fontSize: t.fontSize.xs,
            fontWeight: '700',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: t.color.ink3,
            marginBottom: t.spacing.s2,
          }}
        >
          Upcoming
        </Text>
        <Card>
          {upcoming.length === 0 ? (
            <Text style={{ color: t.color.ink2 }}>No upcoming absences.</Text>
          ) : (
            upcoming.map(u => (
              <Row
                key={u.id}
                title={KIND_LABEL[u.kind]}
                subtitle={rangeLabel(u)}
                leading={
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: kindColor(u.kind, t),
                    }}
                  />
                }
                trailing={<Badge tone="neutral">{KIND_LABEL[u.kind]}</Badge>}
              />
            ))
          )}
        </Card>
      </View>
    </ScreenScaffold>
  )
}
