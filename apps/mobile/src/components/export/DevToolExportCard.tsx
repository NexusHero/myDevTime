import { useEffect, useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import {
  fetchExportRecords,
  runExport,
  type ExportLedgerRecord,
  type ExportOutcome,
  type ExportRunItem,
  type ExportRunRecord,
  type ExportTargetName,
} from '../../api/export.js'
import { Text } from '../core/Text'
import { Badge, Button, Card, SegmentedControl } from '../index'
import { useTheme } from '../../theme/ThemeProvider'

/**
 * Dev-tool export (REQ-035, #44 · ADR-0035/0005). Pick a target (Jira/Linear/Slack), preview the
 * items the user already confirmed, and push them through the backend's narrow `ExportTargetPort` —
 * confirmed-only and idempotent (a stable `dedupeKey` per item keeps a re-run from double-posting).
 *
 * Every outcome is rendered HONESTLY, straight from the backend's report — the card never claims a
 * post that did not happen: `sent` shows the created item's external id/link; `duplicate` says it was
 * already exported; `unavailable` says the target is not configured in this deployment (the live
 * adapters are env-gated, so an unconfigured deployment degrades gracefully to `unavailable` rather
 * than half-posting, ADR-0005); `failed` surfaces the error. The existing ledger (`GET /records`) is
 * listed as the audit trail. Read state is loaded on mount; a run refreshes it.
 */
type ChipTone = 'neutral' | 'accent' | 'good' | 'crit' | 'warn'

const TARGETS: readonly { readonly value: ExportTargetName; readonly label: string }[] = [
  { value: 'jira', label: 'Jira' },
  { value: 'linear', label: 'Linear' },
  { value: 'slack', label: 'Slack' },
]

function outcomeChip(outcome: ExportOutcome): { readonly tone: ChipTone; readonly label: string } {
  switch (outcome) {
    case 'sent':
      return { tone: 'good', label: 'Sent' }
    case 'duplicate':
      return { tone: 'neutral', label: 'Already exported' }
    case 'unavailable':
      return { tone: 'warn', label: 'Unavailable' }
    case 'unconfirmed':
      return { tone: 'neutral', label: 'Not confirmed' }
    case 'failed':
      return { tone: 'crit', label: 'Failed' }
  }
}

function outcomeDetail(outcome: ExportOutcome, error: string | undefined): string {
  switch (outcome) {
    case 'sent':
      return 'Posted to the target tool.'
    case 'duplicate':
      return 'Already exported in an earlier run — not posted again.'
    case 'unavailable':
      return 'This target is not configured in this deployment — nothing was posted.'
    case 'unconfirmed':
      return 'Was not confirmed, so it was not sent.'
    case 'failed':
      return error !== undefined && error.length > 0 ? error : 'The target rejected the item.'
  }
}

export interface DevToolExportCardProps {
  /** The backend base URL, or `null` on demo data (the export button is then disabled). */
  readonly baseUrl: string | null
  /** The confirmed items to preview and export (posting IS the confirmation, REQ-035). */
  readonly items: readonly ExportRunItem[]
}

export function DevToolExportCard({ baseUrl, items }: DevToolExportCardProps): React.JSX.Element {
  const t = useTheme()
  const [target, setTarget] = useState<ExportTargetName>('jira')
  const [ledger, setLedger] = useState<readonly ExportLedgerRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [runRecords, setRunRecords] = useState<readonly ExportRunRecord[] | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const load = async (base: string): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      setLedger(await fetchExportRecords(base))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (baseUrl === null) return
    void load(baseUrl)
    // Load once per base URL — the run handler refreshes it explicitly afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl])

  const run = async (): Promise<void> => {
    if (baseUrl === null || items.length === 0) return
    setBusy(true)
    setRunError(null)
    try {
      const res = await runExport(baseUrl, { target, items })
      setRunRecords(res.records)
      await load(baseUrl)
    } catch (e) {
      setRunRecords(null)
      setRunError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  const labelByKey = new Map(items.map(i => [i.dedupeKey, i.label]))
  const count = items.length
  const sentCount = (runRecords ?? []).filter(r => r.outcome === 'sent').length

  const openLink = (url: string): void => {
    void Linking.openURL(url)
  }

  const link = (url: string, label: string): React.JSX.Element => (
    <Pressable onPress={() => openLink(url)} accessibilityRole="link">
      <Text
        style={{
          fontSize: t.fontSize.xs,
          color: t.color.accent,
          textDecorationLine: 'underline',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )

  return (
    <Card title="Dev-tool export" subtitle="Push confirmed items to Jira, Linear or Slack">
      <View style={{ padding: t.spacing.s4, gap: t.spacing.s3 }}>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
          Exports only items you already confirmed, and never twice — each item carries a stable key
          so a re-run can&apos;t double-post. The outcome is shown exactly as the target reported
          it.
        </Text>

        <SegmentedControl segments={TARGETS} active={target} onChange={setTarget} />

        {/* Preview: the confirmed items that would be pushed. */}
        {count === 0 ? (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            No confirmed items to export yet.
          </Text>
        ) : (
          <View style={{ gap: t.spacing.s2 }}>
            {items.map(i => (
              <Text
                key={i.dedupeKey}
                numberOfLines={1}
                style={{ fontSize: t.fontSize.xs, color: t.color.ink }}
              >
                • {i.label}
              </Text>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row' }}>
          <Button
            size="sm"
            disabled={busy || baseUrl === null || count === 0}
            onPress={() => void run()}
          >
            {busy ? 'Exporting…' : `Export ${String(count)} item${count === 1 ? '' : 's'}`}
          </Button>
        </View>

        {baseUrl === null && (
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            Connect an account to export.
          </Text>
        )}

        {runError !== null && (
          <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.crit }}>
            Export could not be run — {runError}
          </Text>
        )}

        {/* Run result: one honest chip per confirmed item — never a fake success. */}
        {runRecords !== null && (
          <View style={{ gap: t.spacing.s3 }}>
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
              {sentCount > 0
                ? `${String(sentCount)} of ${String(runRecords.length)} pushed to ${target}.`
                : `Nothing pushed to ${target}.`}
            </Text>
            {runRecords.map(rec => {
              const chip = outcomeChip(rec.outcome)
              const externalId = rec.result?.externalId
              const url = rec.result?.url
              return (
                <View key={rec.dedupeKey} style={{ gap: t.spacing.s2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                    <Badge tone={chip.tone} size="sm">
                      {chip.label}
                    </Badge>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink }}
                    >
                      {labelByKey.get(rec.dedupeKey) ?? rec.dedupeKey}
                    </Text>
                  </View>
                  <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                    {outcomeDetail(rec.outcome, rec.result?.error)}
                  </Text>
                  {rec.outcome === 'sent' && externalId !== undefined && (
                    <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                      {externalId}
                    </Text>
                  )}
                  {rec.outcome === 'sent' && url !== undefined && link(url, url)}
                </View>
              )
            })}
          </View>
        )}

        {/* The export ledger (GET /records): the audit trail of where items landed. */}
        <View style={{ gap: t.spacing.s2, marginTop: t.spacing.s2 }}>
          <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.color.ink }}>
            Export history
          </Text>
          {loading && ledger.length === 0 ? (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>Loading…</Text>
          ) : loadError !== null ? (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: t.fontSize.xs, color: t.color.crit }}
            >
              History could not be loaded — {loadError}
            </Text>
          ) : ledger.length === 0 ? (
            <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
              Nothing exported yet.
            </Text>
          ) : (
            ledger.map(rec => {
              const chip = outcomeChip(rec.status)
              return (
                <View key={rec.id} style={{ gap: t.spacing.s2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                    <Badge tone={chip.tone} size="sm">
                      {chip.label}
                    </Badge>
                    <Text
                      numberOfLines={1}
                      style={{ flex: 1, fontSize: t.fontSize.xs, color: t.color.ink }}
                    >
                      {rec.itemLabel}
                    </Text>
                    <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
                      {rec.target}
                    </Text>
                  </View>
                  {rec.externalId !== null && (
                    <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink2 }}>
                      {rec.externalId}
                    </Text>
                  )}
                  {rec.url !== null && link(rec.url, rec.url)}
                </View>
              )
            })
          )}
        </View>
      </View>
    </Card>
  )
}
