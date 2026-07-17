import { useState } from 'react'
import { View } from 'react-native'
import { formatDuration } from '@mydevtime/design'
import type { TravelMode } from '@mydevtime/domain'
import { Text } from '../components/core/Text'
import { Badge, Button, Card, Input, SegmentedControl, Switch } from '../components/index'
import { useTheme } from '../theme/ThemeProvider'
import { apiBaseUrl } from '../config'
import { createEntry } from '../api/nlEntry'
import { buildLeg, previewLeg, returnForm, travelNote, type TravelForm } from '../travel/travelForm'

/**
 * Travel route-card drawer (REQ-051, design v13 G4). A first-class travel entry: a route
 * (from → to), distance, mode, and a "bill this" toggle — with a deterministic preview of
 * the worktime credited (a **train counts as full worktime**, a car at the reduced
 * fraction) and the mileage allowance. A **return-trip nudge** mirrors the leg; the
 * **magnetic chain** pre-fills the next trip's start from the last destination. Every
 * figure is the domain core's (`priceTravel`, ADR-0005); on confirm it creates a real
 * travel-tagged entry. Location is only a place label at the endpoints — never streamed
 * (ADR-0058/0059). Needs the backend; offline it says so.
 */
const MODES: readonly { value: TravelMode; label: string }[] = [
  { value: 'car', label: 'Car' },
  { value: 'train', label: 'Train' },
  { value: 'transit', label: 'Transit' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
]

const EMPTY: TravelForm = {
  from: '',
  to: '',
  distanceKm: 0,
  mode: 'car',
  durationMin: 30,
  billable: true,
}

export function TravelEntry(): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<TravelForm>(EMPTY)
  const [kmText, setKmText] = useState('')
  const [minText, setMinText] = useState('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  /** Magnetic chain: the last destination logged this session, to pre-fill the next start. */
  const [lastTo, setLastTo] = useState<string | null>(null)

  const set = (patch: Partial<TravelForm>): void => setForm(f => ({ ...f, ...patch }))
  const preview = previewLeg(form)

  const confirm = (): void => {
    if (base === null || form.from.trim().length === 0 || form.to.trim().length === 0) return
    setBusy(true)
    setError(null)
    const leg = buildLeg(form, new Date())
    createEntry(base, {
      startedAt: new Date(leg.startMs).toISOString(),
      endedAt: new Date(leg.endMs).toISOString(),
      note: travelNote(leg),
      billable: form.billable,
    })
      .then(() => {
        setDone(travelNote(leg))
        setLastTo(form.to.trim())
        setForm({ ...EMPTY, from: form.to.trim() }) // chain from the destination
        setKmText('')
        setMinText('30')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }

  const applyReturn = (): void => {
    const r = returnForm(form)
    setForm(r)
    setKmText(r.distanceKm > 0 ? String(r.distanceKm) : '')
  }

  if (!open) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: t.fontSize.md, fontWeight: '700', color: t.color.ink }}>
              Log travel
            </Text>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2, marginTop: 2 }}>
              A route with distance & mode — a train counts as full worktime.
            </Text>
          </View>
          <Button size="sm" variant="secondary" onPress={() => setOpen(true)}>
            Add trip
          </Button>
        </View>
      </Card>
    )
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
        <Text style={{ fontSize: t.fontSize.md, fontWeight: '700', color: t.color.ink, flex: 1 }}>
          Log travel
        </Text>
        {base === null && <Badge tone="neutral">Needs backend</Badge>}
        <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
          Close
        </Button>
      </View>

      <View style={{ gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        <Input
          value={form.from}
          onChangeText={v => set({ from: v })}
          placeholder={lastTo !== null ? `From (e.g. ${lastTo})` : 'From'}
        />
        <Input value={form.to} onChangeText={v => set({ to: v })} placeholder="To" />
        <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={kmText}
              onChangeText={v => {
                setKmText(v)
                set({ distanceKm: Number(v.replace(',', '.')) || 0 })
              }}
              placeholder="km"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              value={minText}
              onChangeText={v => {
                setMinText(v)
                set({ durationMin: Number(v) || 0 })
              }}
              placeholder="minutes"
              keyboardType="numeric"
            />
          </View>
        </View>
        <SegmentedControl segments={MODES} active={form.mode} onChange={m => set({ mode: m })} />
        <Switch
          checked={form.billable}
          onChange={next => set({ billable: next })}
          label="Add to invoice (billable)"
        />
      </View>

      {/* Deterministic preview from priceTravel. */}
      <View
        style={{
          marginTop: t.spacing.s3,
          padding: t.spacing.s3,
          borderRadius: t.radius.chip,
          backgroundColor: t.color.raised,
          gap: 2,
        }}
      >
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>
          {`Worktime credited: ${formatDuration(preview.worktimeMs)} h`}
          {preview.isFullWorktime
            ? ' · full (train)'
            : ` · ${String(Math.round(preview.appliedFraction * 100))}%`}
        </Text>
        {form.distanceKm > 0 && (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
            {`${String(form.distanceKm)} km · mileage allowance applies`}
          </Text>
        )}
      </View>

      {error !== null && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.crit }}>
          {error}
        </Text>
      )}
      {done !== null && (
        <Text style={{ marginTop: t.spacing.s2, fontSize: t.fontSize.xs, color: t.color.good }}>
          {`Logged — ${done}`}
        </Text>
      )}

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        <Button
          size="sm"
          disabled={busy || base === null || form.from.trim() === '' || form.to.trim() === ''}
          onPress={confirm}
        >
          Log trip
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={form.from.trim() === '' && form.to.trim() === ''}
          onPress={applyReturn}
        >
          ⇄ Return trip
        </Button>
      </View>
    </Card>
  )
}
