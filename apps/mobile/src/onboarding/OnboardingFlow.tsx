import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Button, Switch, Sevi, Blocky } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { apiBaseUrl } from '../config'
import { createRate, eurosToMinor } from '../api/rates'
import { createProject } from '../api/tracking'

/**
 * First-run onboarding (design v3) — the moment users decide to stay.
 * Welcome → Work time → Projects → Auto-Tracker → Done. Bounded (one card,
 * one decision per step), every step skippable, and privacy is stated exactly
 * where data is touched (ux-vision §5: trust is the aesthetic). Choices are local
 * to the flow; `onDone` hands control to the workspace. UI copy is English-only.
 */
const STEPS = ['Welcome', 'Work time', 'Projects', 'Auto-Tracker', 'Done'] as const

function fmtHM(min: number): string {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

export function OnboardingFlow({ onDone }: { onDone: () => void }): React.JSX.Element {
  const t = useTheme()
  const [step, setStep] = useState(0)
  const last = STEPS.length - 1

  const [daily, setDaily] = useState(504) // 8:24 → 42h week
  const [autoBreak, setAutoBreak] = useState(true)

  const colors = t.projectColors.slice(0, 5)
  const [projects, setProjects] = useState<readonly { name: string; color: string }[]>([])
  const [pName, setPName] = useState('')
  const [pColor, setPColor] = useState(0)
  const [imported, setImported] = useState<string | null>(null)
  const addProject = (): void => {
    const name = pName.trim()
    if (!name) return
    setProjects(ps => [...ps, { name, color: colors[pColor] ?? t.color.accent }])
    setPName('')
    setPColor(c => (c + 1) % colors.length)
  }

  const [tracker, setTracker] = useState<boolean | null>(null)
  const [rate, setRate] = useState('')

  // On finish, persist the typed default hourly rate as the workspace-level rate
  // (REQ-005) — best-effort, so onboarding never blocks on the network; the Rates
  // screen is the durable place to manage rates. Only runs when an API is wired.
  const finish = (): void => {
    if (apiBaseUrl !== null) {
      const minor = eurosToMinor(rate)
      if (minor !== null && minor > 0) {
        void createRate(apiBaseUrl, {
          level: 'workspace',
          scopeId: null,
          amountMinorPerHour: minor,
          effectiveFrom: new Date().toISOString(),
        }).catch(() => undefined)
      }
      // Persist the projects created during onboarding (REQ-044, fixes audit H8):
      // they were accumulated in local state and the Done step claimed "N created",
      // but `finish` never sent them — they were discarded. Best-effort like the
      // rate, so onboarding never blocks on the network; the Projects screen is the
      // durable place to manage them afterwards.
      for (const project of projects) {
        void createProject(apiBaseUrl, { name: project.name, color: project.color }).catch(
          () => undefined,
        )
      }
    }
    onDone()
  }

  const next = (): void => setStep(s => Math.min(last, s + 1))
  const back = (): void => setStep(s => Math.max(0, s - 1))

  const h1 = {
    fontFamily: t.fontFamily.display,
    fontWeight: '700' as const,
    fontSize: t.fontSize.xl,
    letterSpacing: t.fontSize.xl * t.letterSpacing.tight,
    color: t.color.ink,
  }
  const sub = {
    fontSize: t.fontSize.sm,
    color: t.color.ink2,
    lineHeight: t.fontSize.sm * t.lineHeight.normal,
    marginTop: t.spacing.s1,
    marginBottom: t.spacing.s5,
  }
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink }

  const dots = (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 18 }}>
      {STEPS.map((s, i) => (
        <View
          key={s}
          style={{
            width: i === step ? 22 : 7,
            height: 7,
            borderRadius: 999,
            backgroundColor: i === step ? t.color.live : t.color.borderStrong,
          }}
        />
      ))}
    </View>
  )

  const navRow = (opts?: {
    nextLabel?: string
    onNext?: () => void
    skip?: boolean
  }): React.JSX.Element => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: t.spacing.s5 }}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.xs, fontWeight: '600' }}>
          Back
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {(opts?.skip ?? true) && (
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Skip">
          <Text style={{ color: t.color.ink3, fontSize: t.fontSize.xs, fontWeight: '600' }}>
            Skip
          </Text>
        </Pressable>
      )}
      <Button onPress={opts?.onNext ?? next}>{opts?.nextLabel ?? 'Continue'}</Button>
    </View>
  )

  const card = {
    width: '100%' as const,
    maxWidth: 560,
    alignSelf: 'center' as const,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    borderRadius: t.radius.xl,
    padding: t.spacing.s6,
  }

  // ── 0 · Welcome ──────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0d1330', justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', gap: 24 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              backgroundColor: '#3654E0',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 20,
                top: 34,
                width: 22,
                height: 28,
                borderRadius: 6,
                backgroundColor: '#fff',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 54,
                top: 34,
                width: 22,
                height: 28,
                borderRadius: 6,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.8)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 45,
                top: 26,
                width: 5,
                height: 44,
                borderRadius: 3,
                backgroundColor: t.color.live,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 41,
                top: 16,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: t.color.live,
              }}
            />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: t.fontFamily.display,
                fontWeight: '700',
                fontSize: 34,
                letterSpacing: 34 * t.letterSpacing.tight,
                color: '#fff',
              }}
            >
              my<Text style={{ color: t.color.live }}>Dev</Text>Time
            </Text>
            <Text
              style={{
                fontSize: t.fontSize.sm,
                color: 'rgba(255,255,255,0.55)',
                marginTop: 8,
                textAlign: 'center',
              }}
            >
              Your day, planned. Plan and reality on one surface.
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <Button size="lg" onPress={() => setStep(1)}>
              Get started
            </Button>
            <Text
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: t.fontSize.xs,
                fontWeight: '600',
              }}
            >
              I already have an account
            </Text>
          </View>
        </View>
      </View>
    )
  }

  // Steps 1–4 share the light shell + progress dots.
  return (
    <View style={{ flex: 1, backgroundColor: t.color.bg }}>
      {dots}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* ── 1 · Work time ── */}
        {step === 1 && (
          <View style={card}>
            {/* Blocky duo — a solid "tracked" block and a dashed "planned" ghost —
                introduces plan-vs-reality, the app's core idea (edge-only, ADR-0061). */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 20,
                marginBottom: 12,
              }}
            >
              <Blocky variant="solid" size={52} />
              <Blocky variant="ghost" size={52} />
            </View>
            <Text style={h1}>Your daily target hours</Text>
            <Text style={sub}>
              myDevTime uses this to calculate overtime, drift, and your balance. Change it anytime
              in your profile — even per weekday.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 22,
                marginBottom: 18,
              }}
            >
              <StepBtn label="−" onPress={() => setDaily(d => Math.max(240, d - 5))} />
              <View style={{ alignItems: 'center', minWidth: 150 }}>
                <Text style={{ ...mono, fontSize: 46, fontWeight: '600', lineHeight: 48 }}>
                  {fmtHM(daily)}
                </Text>
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: 6 }}>
                  Hours per day
                </Text>
              </View>
              <StepBtn label="+" onPress={() => setDaily(d => Math.min(720, d + 5))} />
            </View>
            <View
              style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 }}
            >
              {[456, 480, 504].map(m => {
                const on = daily === m
                return (
                  <Pressable
                    key={m}
                    onPress={() => setDaily(m)}
                    style={{
                      paddingVertical: 7,
                      paddingHorizontal: 14,
                      borderRadius: t.radius.pill,
                      borderWidth: on ? 1.5 : 1,
                      borderColor: on ? t.color.accent : t.color.border,
                      backgroundColor: on ? t.color.accentSoft : t.color.surface,
                    }}
                  >
                    <Text
                      style={{
                        ...mono,
                        fontSize: t.fontSize.xs,
                        fontWeight: '600',
                        color: on ? t.color.accentText : t.color.ink2,
                      }}
                    >
                      {fmtHM(m)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 14,
                borderRadius: t.radius.block,
                backgroundColor: t.color.sunk,
              }}
            >
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Week (×5)</Text>
              <Text style={{ ...mono, fontSize: t.fontSize.sm, fontWeight: '600' }}>
                {fmtHM(daily * 5)} h
              </Text>
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}
            >
              <Switch
                checked={autoBreak}
                onChange={setAutoBreak}
                accessibilityLabel="Automatically deduct statutory breaks"
              />
              <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                Automatically deduct statutory breaks (30 min after 6 h)
              </Text>
            </View>
            {navRow({ skip: false })}
          </View>
        )}

        {/* ── 2 · Projects ── */}
        {step === 2 && (
          <View style={card}>
            <Text style={h1}>What are you working on?</Text>
            <Text style={sub}>
              Create your first project — or bring your history with you. Colors come from the fixed
              project palette.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TextInput
                value={pName}
                onChangeText={setPName}
                onSubmitEditing={addProject}
                placeholder="Project name, e.g. Finanzo AG"
                placeholderTextColor={t.color.ink3}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: t.radius.block,
                  borderWidth: 1,
                  borderColor: t.color.borderStrong,
                  backgroundColor: t.color.surface,
                  color: t.color.ink,
                  fontFamily: t.fontFamily.ui,
                  fontSize: t.fontSize.sm,
                }}
              />
              <Button onPress={addProject} disabled={!pName.trim()}>
                Create
              </Button>
            </View>
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3, marginBottom: 6 }}>
                Default hourly rate (€/h) — optional, changeable later per client & project
              </Text>
              <TextInput
                value={rate}
                onChangeText={setRate}
                placeholder="e.g. 90"
                placeholderTextColor={t.color.ink3}
                keyboardType="numeric"
                accessibilityLabel="Default hourly rate"
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: t.radius.block,
                  borderWidth: 1,
                  borderColor: t.color.borderStrong,
                  backgroundColor: t.color.surface,
                  color: t.color.ink,
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize.sm,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {colors.map((c, i) => (
                <Pressable
                  key={c}
                  onPress={() => setPColor(i)}
                  accessibilityLabel={`Color ${String(i + 1)}`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: c,
                    borderWidth: 2.5,
                    borderColor: pColor === i ? t.color.ink : 'transparent',
                  }}
                />
              ))}
            </View>
            {projects.length > 0 && (
              <ScrollView style={{ maxHeight: 130, marginBottom: 18 }}>
                <View style={{ gap: 8 }}>
                  {projects.map(p => (
                    <View
                      key={p.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        borderRadius: t.radius.block,
                        borderWidth: 1,
                        borderColor: t.color.border,
                      }}
                    >
                      <View
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          backgroundColor: `${p.color}22`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: t.fontFamily.display,
                            fontWeight: '700',
                            fontSize: 12,
                            color: p.color,
                          }}
                        >
                          {p.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <Text
                        style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}
                      >
                        {p.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
            <View style={{ borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: 16 }}>
              <Text
                style={{
                  fontSize: t.fontSize['2xs'],
                  fontWeight: '700',
                  letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
                  color: t.color.ink3,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Or import
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {['Toggl', 'Clockify', 'CSV'].map(src => {
                  const on = imported === src
                  return (
                    <Pressable
                      key={src}
                      onPress={() => setImported(on ? null : src)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: t.radius.pill,
                        borderWidth: on ? 1.5 : 1,
                        borderColor: on ? t.color.accent : t.color.borderStrong,
                        backgroundColor: on ? t.color.accentSoft : t.color.surface,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: t.fontSize.xs,
                          fontWeight: '600',
                          color: on ? t.color.accentText : t.color.ink2,
                        }}
                      >
                        {on ? `✓ ${src}` : src}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              {imported !== null && (
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3, marginTop: 10 }}>
                  Import from {imported} is coming soon. In the meantime, create your first project
                  above — that's enough to get started.
                </Text>
              )}
            </View>
            {navRow()}
          </View>
        )}

        {/* ── 3 · Auto-Tracker ── */}
        {step === 3 && (
          <View style={card}>
            <Text style={h1}>Enable Auto-Tracker?</Text>
            <Text style={sub}>
              While a timer runs, myDevTime can record locally which apps you use and for how long —
              your day fills itself in.
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: t.radius.xl,
                borderWidth: 1,
                borderColor: t.color.live,
                backgroundColor: t.color.liveSoft,
                marginBottom: 16,
              }}
            >
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color.live }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.color.ink }}>
                  VS Code · 1h 36m
                </Text>
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                  This is what a recorded entry looks like.
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  fontWeight: '700',
                  letterSpacing: t.fontSize['2xs'] * t.letterSpacing.wide,
                  color: t.color.liveStrong,
                }}
              >
                REC
              </Text>
            </View>
            <View style={{ gap: 9, marginBottom: 8 }}>
              {[
                'Stays 100% on this device — nothing goes to the cloud',
                'Exclude individual apps anytime',
                'Runs only while you track — never in the background',
              ].map(line => (
                <View key={line} style={{ flexDirection: 'row', gap: 9 }}>
                  <Text style={{ color: t.color.good, fontWeight: '700', fontSize: t.fontSize.xs }}>
                    ✓
                  </Text>
                  <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                    {line}
                  </Text>
                </View>
              ))}
            </View>
            {navRow({
              nextLabel: tracker === false ? 'Continue' : 'Enable & continue',
              skip: false,
              onNext: () => {
                if (tracker === null) setTracker(true)
                setStep(4)
              },
            })}
            <Pressable
              onPress={() => {
                setTracker(false)
                setStep(4)
              }}
              style={{ marginTop: 6, paddingVertical: 6 }}
            >
              <Text style={{ color: t.color.ink3, fontSize: t.fontSize.xs, fontWeight: '600' }}>
                Not now — later in profile
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 4 · Done ── */}
        {step === 4 && (
          <View style={{ ...card, alignItems: 'center' }}>
            {/* The onboarding-completion moment: Sevi celebrates (edge-only, ADR-0061). */}
            <View style={{ marginBottom: 14 }}>
              <Sevi mood="celebrate" size={72} />
            </View>
            <Text style={h1}>All set.</Text>
            <Text style={{ ...sub, textAlign: 'center' }}>
              Your first day is still empty — exactly right. Start the timer when you begin, or let
              the Co-Planner make a suggestion.
            </Text>
            <View style={{ alignSelf: 'stretch', gap: 8, marginBottom: 24 }}>
              {(
                [
                  ['Target hours', `${fmtHM(daily)} h/day · ${fmtHM(daily * 5)} h/week`],
                  ['Auto-Tracker', tracker ? 'active (local)' : 'off'],
                ] as const
              ).map(([k, v]) => (
                <View
                  key={k}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: t.radius.block,
                    backgroundColor: t.color.sunk,
                  }}
                >
                  <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>{k}</Text>
                  <Text style={{ ...mono, fontSize: t.fontSize.xs, fontWeight: '600' }}>{v}</Text>
                </View>
              ))}
            </View>
            <Button size="lg" onPress={finish}>
              Go to workspace
            </Button>
          </View>
        )}
      </View>
    </View>
  )
}

/** A round +/− stepper button used on the work-time step. */
function StepBtn({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  const t = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? '5 minutes more' : '5 minutes less'}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.color.borderStrong,
        backgroundColor: t.color.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 20, color: t.color.ink2 }}>{label}</Text>
    </Pressable>
  )
}
