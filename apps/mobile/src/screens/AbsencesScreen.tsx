import { ScrollView, View } from 'react-native'
import { monthGrid, weekdayHeaders } from '@mydevtime/design'
import { Text } from '../components/core/Text'
import { Badge, Card, ProgressBar, Row } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { SubScreenHeader } from './SubScreenHeader'

/**
 * Absences (#37, ux-vision §3) — the vacation / sick / public-holiday calendar
 * that the Profile hub links into. The month grid comes from the pure, tested
 * `monthGrid` helper (ADR-0005); day markers, the remaining-days balance, and the
 * upcoming list are illustrative until the absence domain feeds them, but the
 * grid math and tabular formatting are the real shared primitives.
 */
type AbsenceKind = 'vacation' | 'sick' | 'holiday'

// July 2026, keyed by day-of-month.
const MONTH = { year: 2026, month0: 6, label: 'July 2026', today: 10 }
const MARKS: Readonly<Record<number, AbsenceKind>> = {
  6: 'sick',
  14: 'vacation',
  15: 'vacation',
  16: 'vacation',
  17: 'vacation',
  29: 'holiday',
}

const VACATION_USED = 18
const VACATION_ALLOWANCE = 30

interface Upcoming {
  readonly id: string
  readonly label: string
  readonly when: string
  readonly kind: AbsenceKind
}
const UPCOMING: readonly Upcoming[] = [
  { id: 'u1', label: 'Summer vacation', when: 'Jul 14 – 17', kind: 'vacation' },
  { id: 'u2', label: 'Public holiday', when: 'Jul 29', kind: 'holiday' },
]

function kindColor(kind: AbsenceKind, t: ReturnType<typeof useTheme>): string {
  if (kind === 'vacation') return t.color.good
  if (kind === 'sick') return t.color.warn
  return t.color.accent
}

const KIND_LABEL: Record<AbsenceKind, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  holiday: 'Holiday',
}

export function AbsencesScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  const t = useTheme()
  const weeks = monthGrid(MONTH.year, MONTH.month0, true)
  const headers = weekdayHeaders(true)
  const remaining = VACATION_ALLOWANCE - VACATION_USED

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.color.bg }}
      contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s5 }}
    >
      <SubScreenHeader
        title="Absences"
        subtitle="Vacation, sick days & public holidays"
        onBack={onBack}
      />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.spacing.s2 }}>
          <Text
            style={{
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xl,
              fontWeight: '700',
              color: t.color.ink,
            }}
          >
            {String(remaining)}
          </Text>
          <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>vacation days left</Text>
          <Text
            style={{
              marginLeft: 'auto',
              fontFamily: t.fontFamily.numeric,
              fontSize: t.fontSize.xs,
              color: t.color.ink3,
            }}
          >
            {String(VACATION_USED)}/{String(VACATION_ALLOWANCE)}
          </Text>
        </View>
        <View style={{ marginTop: t.spacing.s3 }}>
          <ProgressBar ratio={VACATION_USED / VACATION_ALLOWANCE} label="Vacation days used" />
        </View>
      </Card>

      <Card title={MONTH.label}>
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
                const mark = cell.inMonth ? MARKS[cell.date] : undefined
                const isToday = cell.inMonth && cell.date === MONTH.today
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
          {UPCOMING.map(u => (
            <Row
              key={u.id}
              title={u.label}
              subtitle={u.when}
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
          ))}
        </Card>
      </View>
    </ScrollView>
  )
}
