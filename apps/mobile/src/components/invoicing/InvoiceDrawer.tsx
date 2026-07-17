import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, View } from 'react-native'
import { formatDuration, formatMoneyMinor } from '@mydevtime/design'
import { Text } from '../core/Text'
import { Button } from '../core/Button'
import { useTheme } from '../../theme/ThemeProvider'
import { apiBaseUrl } from '../../config'
import {
  issueInvoice,
  previewInvoice,
  type InvoiceLineDTO,
  type IssuedInvoiceDTO,
} from '../../api/invoicing'
import { InvoiceDraftView } from './InvoiceDraftView'
import { InsightCard } from '../data/InsightCard'

/** A client with open (un-invoiced) billable work — the drawer's first step. */
export interface DrawerClient {
  readonly clientId: string
  readonly name: string
  readonly openMs: number
  readonly openMinor: number
}

interface InvoiceDrawerProps {
  readonly open: boolean
  readonly clients: readonly DrawerClient[]
  readonly currencyCode: string
  readonly nameByProject: ReadonlyMap<string, string>
  readonly onClose: () => void
  readonly onIssued: (invoice: IssuedInvoiceDTO) => void
}

// Bill all open work up to now (the period picker is a follow-up refinement).
const WINDOW = {
  from: new Date(0).toISOString(),
  to: new Date(Date.now() + 86_400_000).toISOString(),
}

/**
 * The invoicing drawer (design v6, ADR-0051): pick a client with
 * open work → preview its still-open billable positions (deselect any) → issue.
 * Server-authoritative: the total the user sees is the deterministic core's and
 * the server re-checks the selection on issue. On success it hands the frozen
 * invoice up so the screen can offer an undo. Only reachable when an API is
 * configured (the demo path fabricates no money, ADR-0005).
 */
export function InvoiceDrawer({
  open,
  clients,
  currencyCode,
  nameByProject,
  onClose,
  onIssued,
}: InvoiceDrawerProps): React.JSX.Element {
  const t = useTheme()
  const base = apiBaseUrl
  const [client, setClient] = useState<DrawerClient | null>(null)
  const [lines, setLines] = useState<InvoiceLineDTO[] | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when the drawer closes so a re-open starts at the client list.
  useEffect(() => {
    if (!open) {
      setClient(null)
      setLines(null)
      setError(null)
    }
  }, [open])

  // Load the selected client's open lines; preselect the priced ones.
  useEffect(() => {
    if (base === null || client === null) return
    let alive = true
    setLines(null)
    setError(null)
    previewInvoice(base, { clientId: client.clientId, from: WINDOW.from, to: WINDOW.to })
      .then(p => {
        if (!alive) return
        setLines([...p.lines])
        setSelected(new Set(p.lines.filter(l => l.priced).map(l => l.entryId)))
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load')
      })
    return () => {
      alive = false
    }
  }, [base, client])

  const toggle = (entryId: string): void =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })

  const issue = (): void => {
    if (base === null || client === null) return
    setBusy(true)
    setError(null)
    issueInvoice(base, {
      clientId: client.clientId,
      from: WINDOW.from,
      to: WINDOW.to,
      entryIds: [...selected],
    })
      .then(invoice => {
        setBusy(false)
        onIssued(invoice)
        onClose()
      })
      .catch((e: unknown) => {
        setBusy(false)
        setError(e instanceof Error ? e.message : 'Invoicing failed')
      })
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View
          style={{
            backgroundColor: t.color.surface,
            borderTopLeftRadius: t.radius.card,
            borderTopRightRadius: t.radius.card,
            padding: t.spacing.s5,
            gap: t.spacing.s4,
            maxHeight: '85%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={{
                fontSize: t.fontSize.lg,
                fontWeight: '700',
                color: t.color.ink,
                fontFamily: t.fontFamily.display,
              }}
            >
              {client ? `Invoice · ${client.name}` : 'Create invoice'}
            </Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" style={{ marginLeft: 'auto' }}>
              <Text style={{ fontSize: t.fontSize.lg, color: t.color.ink3 }}>✕</Text>
            </Pressable>
          </View>

          {error !== null && (
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.crit }}>{error}</Text>
          )}

          <ScrollView>
            {client === null ? (
              <View style={{ gap: t.spacing.s1 }}>
                {clients.length === 0 ? (
                  <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
                    Nothing open right now.
                  </Text>
                ) : (
                  clients.map(c => (
                    <Pressable
                      key={c.clientId}
                      onPress={() => setClient(c)}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: t.spacing.s3,
                        borderBottomWidth: 1,
                        borderBottomColor: t.color.border,
                      }}
                    >
                      <Text style={{ fontSize: t.fontSize.md, color: t.color.ink }}>{c.name}</Text>
                      <Text
                        style={{
                          fontFamily: t.fontFamily.numeric,
                          fontSize: t.fontSize.sm,
                          fontWeight: '600',
                          color: t.color.ink2,
                        }}
                      >
                        {formatDuration(c.openMs)} h · {formatMoneyMinor(c.openMinor, currencyCode)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : lines === null ? (
              <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink2 }}>
                Loading positions…
              </Text>
            ) : (
              <>
                <InvoiceDraftView
                  lines={lines}
                  currencyCode={currencyCode}
                  nameByProject={nameByProject}
                  selected={selected}
                  onToggle={toggle}
                  onIssue={issue}
                  busy={busy}
                />
                {/* KI3 — translate the selected lines' dev-jargon notes into client prose. */}
                {(() => {
                  const notes = lines
                    .filter(l => selected.has(l.entryId) && l.note !== null && l.note.trim() !== '')
                    .map(l => l.note as string)
                  if (notes.length === 0) return null
                  return (
                    <View style={{ marginTop: t.spacing.s3 }}>
                      <InsightCard
                        kind="invoice"
                        title="Translate for the client"
                        subtitle="Turn the selected notes into clear invoice line items"
                        cta="Rewrite notes"
                        facts={notes}
                      />
                    </View>
                  )
                })()}
              </>
            )}
          </ScrollView>

          {client !== null && (
            <Button variant="ghost" onPress={() => setClient(null)}>
              ← Another client
            </Button>
          )}
        </View>
      </View>
    </Modal>
  )
}
