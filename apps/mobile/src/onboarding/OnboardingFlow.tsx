import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '../components/core/Text'
import { Button, Switch } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'

/**
 * First-run onboarding (design v3) — the moment users decide to stay.
 * Welcome → Arbeitszeit → Projekte → Auto-Tracker → Fertig. Bounded (one card,
 * one decision per step), every step skippable, and privacy is stated exactly
 * where data is touched (ux-vision §5: trust is the aesthetic). Choices are local
 * to the flow; `onDone` hands control to the workspace. Copy stays German per the
 * design system.
 */
const STEPS = ['Willkommen', 'Arbeitszeit', 'Projekte', 'Auto-Tracker', 'Fertig'] as const

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

  const next = (): void => setStep(s => Math.min(last, s + 1))
  const back = (): void => setStep(s => Math.max(0, s - 1))

  const h1 = {
    fontFamily: t.fontFamily.display,
    fontWeight: '700' as const,
    fontSize: t.fontSize.xl,
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
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Zurück">
        <Text style={{ color: t.color.ink2, fontSize: t.fontSize.xs, fontWeight: '600' }}>
          Zurück
        </Text>
      </Pressable>
      <View style={{ flex: 1 }} />
      {(opts?.skip ?? true) && (
        <Pressable onPress={next} accessibilityRole="button" accessibilityLabel="Überspringen">
          <Text style={{ color: t.color.ink3, fontSize: t.fontSize.xs, fontWeight: '600' }}>
            Überspringen
          </Text>
        </Pressable>
      )}
      <Button onPress={opts?.onNext ?? next}>{opts?.nextLabel ?? 'Weiter'}</Button>
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
              Dein Tag, geplant. Plan und Realität auf einer Fläche.
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <Button size="lg" onPress={() => setStep(1)}>
              Los geht&apos;s
            </Button>
            <Text
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: t.fontSize.xs,
                fontWeight: '600',
              }}
            >
              Ich habe schon ein Konto
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
        {/* ── 1 · Arbeitszeit ── */}
        {step === 1 && (
          <View style={card}>
            <Text style={h1}>Deine tägliche Sollzeit</Text>
            <Text style={sub}>
              Daraus rechnet myDevTime Überstunden, Drift und deine Balance. Später jederzeit im
              Profil änderbar — auch pro Wochentag.
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
                  Stunden pro Tag
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
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Woche (×5)</Text>
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
                accessibilityLabel="Gesetzliche Pausen automatisch abziehen"
              />
              <Text style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink2 }}>
                Gesetzliche Pausen automatisch abziehen (30 min ab 6 h)
              </Text>
            </View>
            {navRow({ skip: false })}
          </View>
        )}

        {/* ── 2 · Projekte ── */}
        {step === 2 && (
          <View style={card}>
            <Text style={h1}>Woran arbeitest du?</Text>
            <Text style={sub}>
              Leg dein erstes Projekt an — oder bring deine Historie mit. Farben kommen aus der
              festen Projekt-Palette.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TextInput
                value={pName}
                onChangeText={setPName}
                onSubmitEditing={addProject}
                placeholder="Projektname, z. B. Finanzo AG"
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
                Anlegen
              </Button>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
              {colors.map((c, i) => (
                <Pressable
                  key={c}
                  onPress={() => setPColor(i)}
                  accessibilityLabel={`Farbe ${String(i + 1)}`}
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
                Oder importieren
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {['Toggl', 'Clockify', 'CSV'].map(src => {
                  const on = imported === src
                  return (
                    <Pressable
                      key={src}
                      onPress={() => {
                        setImported(src)
                        setProjects(ps =>
                          ps.length
                            ? ps
                            : [
                                { name: 'Finanzo AG', color: colors[0] ?? t.color.accent },
                                { name: 'Sync engine', color: colors[1] ?? t.color.accent },
                                { name: 'Nordwind GmbH', color: colors[2] ?? t.color.accent },
                              ],
                        )
                      }}
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
                <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.good, marginTop: 10 }}>
                  3 Projekte aus {imported} importiert — Zeiten folgen im Hintergrund.
                </Text>
              )}
            </View>
            {navRow()}
          </View>
        )}

        {/* ── 3 · Auto-Tracker ── */}
        {step === 3 && (
          <View style={card}>
            <Text style={h1}>Auto-Tracker aktivieren?</Text>
            <Text style={sub}>
              Während ein Timer läuft, kann myDevTime lokal aufzeichnen, welche Apps du wie lange
              nutzt — dein Tag füllt sich von selbst.
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
                  So sieht ein aufgezeichneter Eintrag aus.
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: t.fontFamily.numeric,
                  fontSize: t.fontSize['2xs'],
                  fontWeight: '700',
                  color: t.color.liveStrong,
                }}
              >
                REC
              </Text>
            </View>
            <View style={{ gap: 9, marginBottom: 8 }}>
              {[
                'Bleibt zu 100 % auf diesem Gerät — nichts geht in die Cloud',
                'Einzelne Apps jederzeit ausschließbar',
                'Läuft nur, während du trackst — nie im Hintergrund',
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
              nextLabel: tracker === false ? 'Weiter' : 'Aktivieren & weiter',
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
                Jetzt nicht — später im Profil
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── 4 · Fertig ── */}
        {step === 4 && (
          <View style={{ ...card, alignItems: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: t.color.goodSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Text style={{ color: t.color.good, fontSize: 26 }}>✓</Text>
            </View>
            <Text style={h1}>Alles bereit.</Text>
            <Text style={{ ...sub, textAlign: 'center' }}>
              Dein erster Tag ist noch leer — genau richtig. Starte den Timer, wenn du loslegst,
              oder lass den Co-Planner einen Vorschlag machen.
            </Text>
            <View style={{ alignSelf: 'stretch', gap: 8, marginBottom: 24 }}>
              {(
                [
                  ['Sollzeit', `${fmtHM(daily)} h/Tag · ${fmtHM(daily * 5)} h/Woche`],
                  [
                    'Projekte',
                    projects.length > 0
                      ? `${String(projects.length)} angelegt`
                      : 'noch keine — geht auch später',
                  ],
                  ['Auto-Tracker', tracker ? 'aktiv (lokal)' : 'aus'],
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
            <Button size="lg" onPress={onDone}>
              Zum Workspace
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
      accessibilityLabel={label === '+' ? '5 Minuten mehr' : '5 Minuten weniger'}
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
