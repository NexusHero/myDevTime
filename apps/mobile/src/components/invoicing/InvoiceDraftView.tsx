import { Pressable, View } from 'react-native'
import { formatDuration, formatMoneyMinor } from '@mydevtime/design'
import { summarizeInvoice } from '@mydevtime/domain'
import { Text } from '../core/Text'
import { Badge } from '../core/Badge'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import type { InvoiceLineDTO } from '../../api/invoicing'

/**
 * The "Abrechnung erstellen" draft (design v6, ADR-0051) as a **pure**
 * presentational view: the priced positions with per-line checkboxes and a live
 * h/€ total. The total reuses the deterministic `summarizeInvoice` over the
 * selected ids — the exact same core the server freezes on issue, so what the
 * user sees is what they get. No fetching here; the container owns that.
 */
interface InvoiceDraftViewProps {
  readonly lines: readonly InvoiceLineDTO[]
  readonly currencyCode: string
  readonly nameByProject: ReadonlyMap<string, string>
  readonly selected: ReadonlySet<string>
  readonly onToggle: (entryId: string) => void
  readonly onIssue: () => void
  readonly busy?: boolean
}

export function InvoiceDraftView({
  lines,
  currencyCode,
  nameByProject,
  selected,
  onToggle,
  onIssue,
  busy = false,
}: InvoiceDraftViewProps): React.JSX.Element {
  const t = useTheme()
  // The live total is the deterministic core's, over the selected ids (DTO shape
  // matches the domain `InvoiceLine`, so the tested function drives the sum).
  const draft = summarizeInvoice(lines, selected)
  const mono = { fontFamily: t.fontFamily.numeric, color: t.color.ink, fontWeight: '600' as const }

  return (
    <View style={{ gap: t.spacing.s3 }}>
      {lines.length === 0 ? (
        <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
          Nichts Offenes in diesem Zeitraum.
        </Text>
      ) : (
        <View style={{ gap: t.spacing.s1 }}>
          {lines.map(line => {
            const on = selected.has(line.entryId)
            return (
              <Pressable
                key={line.entryId}
                onPress={() => onToggle(line.entryId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={nameByProject.get(line.projectId) ?? line.projectId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.s3,
                  paddingVertical: t.spacing.s2,
                }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: on ? t.color.accent : t.color.borderStrong,
                    backgroundColor: on ? t.color.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {on && (
                    <Text style={{ color: t.color.accentInk, fontSize: 11, fontWeight: '700' }}>
                      ✓
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: t.fontSize.sm, color: t.color.ink }}>
                    {nameByProject.get(line.projectId) ?? 'Projekt'}
                    {line.note ? ` · ${line.note}` : ''}
                  </Text>
                </View>
                {!line.priced && <Badge tone="warn">kein Satz</Badge>}
                <Text style={{ ...mono, fontSize: t.fontSize.xs }}>
                  {formatDuration(line.durationMs)} h
                </Text>
                <Text
                  style={{ ...mono, fontSize: t.fontSize.xs, minWidth: 64, textAlign: 'right' }}
                >
                  {formatMoneyMinor(line.amountMinor, currencyCode)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTopWidth: 1,
          borderTopColor: t.color.border,
          paddingTop: t.spacing.s3,
        }}
      >
        <Text style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink2 }}>
          Summe · {formatDuration(draft.totalDurationMs)} h
        </Text>
        <Text style={{ ...mono, fontSize: t.fontSize.lg }}>
          {formatMoneyMinor(draft.totalMinor, currencyCode)}
        </Text>
      </View>

      <Button onPress={onIssue} disabled={busy || draft.lines.length === 0} fullWidth>
        {busy ? 'Erstelle…' : 'Abrechnung erstellen'}
      </Button>
    </View>
  )
}
