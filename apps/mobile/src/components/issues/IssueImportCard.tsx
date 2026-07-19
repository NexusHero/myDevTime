import { useState } from 'react'
import { Linking, Pressable, View } from 'react-native'
import { Text } from '../core/Text'
import { Badge, Button, Card, Checkbox, SegmentedControl, useToast } from '../index'
import { useTheme } from '../../theme/ThemeProvider'
import { ApiError } from '../../api/http.js'
import {
  previewIssueImport,
  recordImported,
  type CandidateTaskProposal,
  type ImportedIssueLink,
  type IssueImportPreview,
  type IssueSource,
} from '../../api/issues.js'
import { createTask } from '../../api/tracking.js'

/**
 * Issue/ticket import (M3, ADR-0005). Preview the issues a connected GitHub / Azure DevOps
 * connector would bring in, review them as **proposals**, and confirm the selected ones into
 * real tasks. Nothing is created until the user hits Import — the create IS the confirmation;
 * the card never auto-imports. Every state is HONEST: a `no-consent` status (or the backend's
 * 409) shows the real reason and imports nothing; `unavailable` says the connector is not
 * configured in this deployment; an empty proposal list says so plainly. A confirmed import
 * creates one task per selected proposal via the existing task-create client and reports how
 * many were created — it never claims a create that did not happen.
 */
const SOURCES: readonly { readonly value: IssueSource; readonly label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'azure-devops', label: 'Azure DevOps' },
]

const SOURCE_LABEL: Record<IssueSource, string> = {
  github: 'GitHub',
  'azure-devops': 'Azure DevOps',
}

/** The server's honest reason (RFC 7807 detail/title), or a neutral fallback. */
function honestReason(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.detail ?? err.title) : fallback
}

export interface IssueImportProject {
  readonly id: string
  readonly name: string
}

export interface IssueImportCardProps {
  /** The backend base URL, or `null` on demo data (Preview/Import are then disabled). */
  readonly baseUrl: string | null
  /** Projects the imported tasks can land under; the picker cycles through them. */
  readonly projects: readonly IssueImportProject[]
}

export function IssueImportCard({ baseUrl, projects }: IssueImportCardProps): React.JSX.Element {
  const t = useTheme()
  const toast = useToast()

  const [source, setSource] = useState<IssueSource>('github')
  const [projectIdx, setProjectIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<IssueImportPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  const project = projects[projectIdx % Math.max(projects.length, 1)]
  const proposals: readonly CandidateTaskProposal[] = preview?.proposals ?? []
  const status = preview?.status ?? 'ok'
  const selectedCount = proposals.filter(p => selected.has(p.externalKey)).length
  const allSelected = proposals.length > 0 && selectedCount === proposals.length

  const runPreview = async (): Promise<void> => {
    if (baseUrl === null) return
    setBusy(true)
    setPreviewError(null)
    setImportError(null)
    setImportedCount(null)
    setSelected(new Set())
    try {
      setPreview(await previewIssueImport(baseUrl, source, { state: 'open' }))
    } catch (err) {
      // 409 "not consented" / "not connected" / "not an issues connector" → honest reason.
      setPreview(null)
      setPreviewError(honestReason(err, 'Issue preview is unavailable right now'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (externalKey: string): void => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(externalKey)) next.delete(externalKey)
      else next.add(externalKey)
      return next
    })
  }

  const toggleAll = (): void => {
    setSelected(allSelected ? new Set() : new Set(proposals.map(p => p.externalKey)))
  }

  const runImport = async (): Promise<void> => {
    if (baseUrl === null || project === undefined) return
    const chosen = proposals.filter(p => selected.has(p.externalKey))
    if (chosen.length === 0) return
    setImporting(true)
    setImportError(null)
    setImportedCount(null)
    try {
      // One task per selected proposal — the create is the user's confirmation (ADR-0005).
      const results = await Promise.allSettled(
        chosen.map(p => createTask(baseUrl, { name: p.title, projectId: project.id })),
      )
      const created = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - created
      // Record each created ticket so the next preview won't re-propose it (REQ-066). Best-effort:
      // the tasks already exist, so a record failure must not report the import as failed.
      const links: ImportedIssueLink[] = []
      results.forEach((r, i) => {
        const p = chosen[i]
        if (r.status === 'fulfilled' && p !== undefined) {
          links.push({ externalKey: p.externalKey, taskId: r.value.id })
        }
      })
      if (links.length > 0) {
        try {
          await recordImported(baseUrl, source, links)
        } catch {
          // Dedup is best-effort; the created tasks stand regardless.
        }
      }
      setImportedCount(created)
      setSelected(new Set())
      toast.show(
        `${String(created)} task${created === 1 ? '' : 's'} imported into ${project.name}` +
          (failed > 0 ? ` · ${String(failed)} failed` : ''),
      )
      if (failed > 0 && created === 0)
        setImportError('None of the selected issues could be imported.')
    } catch (err) {
      setImportError(honestReason(err, 'Import failed'))
    } finally {
      setImporting(false)
    }
  }

  const openLink = (url: string): void => {
    if (url.length > 0) void Linking.openURL(url)
  }

  return (
    <Card title="Import issues" subtitle="Preview issues from GitHub / Azure DevOps as tasks">
      <View style={{ gap: t.spacing.s3 }}>
        <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink2 }}>
          These are proposals — nothing is imported until you pick issues and hit Import. Each
          confirmed issue becomes one task (ADR-0005).
        </Text>

        <SegmentedControl segments={SOURCES} active={source} onChange={setSource} />

        {/* Where confirmed tasks land — tap to cycle through your projects. */}
        {projects.length > 0 ? (
          <Pressable
            onPress={() => setProjectIdx(i => (i + 1) % projects.length)}
            accessibilityRole="button"
            accessibilityLabel={`Import into ${project?.name ?? 'a project'}, tap to change`}
            style={{
              padding: t.spacing.s3,
              borderRadius: t.radius.block,
              borderWidth: 1,
              borderColor: t.color.border,
              backgroundColor: t.color.surface,
            }}
          >
            <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>Import into</Text>
            <Text style={{ fontSize: t.fontSize.sm, color: t.color.ink, fontWeight: '600' }}>
              {project?.name ?? 'No project'}
            </Text>
          </Pressable>
        ) : (
          <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
            Create a project first — imported issues need a project to land in.
          </Text>
        )}

        <View style={{ flexDirection: 'row' }}>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || baseUrl === null}
            onPress={() => void runPreview()}
          >
            {busy ? 'Loading preview…' : `Preview ${SOURCE_LABEL[source]} issues`}
          </Button>
        </View>

        {baseUrl === null && (
          <Text style={{ fontSize: t.fontSize['2xs'], color: t.color.ink3 }}>
            Connect a backend to preview issues.
          </Text>
        )}

        {previewError !== null && (
          <Text accessibilityRole="alert" style={{ fontSize: t.fontSize.xs, color: t.color.warn }}>
            {previewError}
          </Text>
        )}

        {preview !== null && previewError === null && (
          <View style={{ gap: t.spacing.s3 }}>
            {status === 'no-consent' ? (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                Grant this connector consent (and connect it) to preview its issues — nothing was
                imported.
              </Text>
            ) : status === 'unavailable' ? (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                {SOURCE_LABEL[source]} import is not configured in this deployment.
              </Text>
            ) : proposals.length === 0 ? (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.ink3 }}>
                No open issues to import — nothing to propose.
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleAll}
                    label={allSelected ? 'Deselect all' : 'Select all'}
                  />
                  <Text
                    style={{
                      marginLeft: 'auto',
                      fontSize: t.fontSize['2xs'],
                      color: t.color.ink3,
                    }}
                  >
                    {String(proposals.length)} proposal{proposals.length === 1 ? '' : 's'} · nothing
                    imported yet
                  </Text>
                </View>

                {proposals.map(p => {
                  const checked = selected.has(p.externalKey)
                  return (
                    <View
                      key={p.externalKey}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: t.spacing.s3,
                        paddingVertical: t.spacing.s2,
                        paddingHorizontal: t.spacing.s3,
                        borderRadius: t.radius.card,
                        borderWidth: 1,
                        borderColor: t.color.border,
                        backgroundColor: t.color.sunk,
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={() => toggle(p.externalKey)}
                        label={`Select ${p.title}`}
                      />
                      <View style={{ flex: 1, minWidth: 0, gap: t.spacing.s2 }}>
                        <Text
                          numberOfLines={2}
                          style={{ fontSize: t.fontSize.sm, fontWeight: '600', color: t.color.ink }}
                        >
                          {p.title}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: t.spacing.s2,
                          }}
                        >
                          <Badge tone="accent" size="sm">
                            {SOURCE_LABEL[p.source]}
                          </Badge>
                          <Text
                            style={{
                              fontFamily: t.fontFamily.numeric,
                              fontSize: t.fontSize['2xs'],
                              color: t.color.ink3,
                            }}
                          >
                            {p.externalKey}
                          </Text>
                          {p.labels.map(l => (
                            <Badge key={l} tone="neutral" size="sm">
                              {l}
                            </Badge>
                          ))}
                        </View>
                        {p.url.length > 0 && (
                          <Pressable onPress={() => openLink(p.url)} accessibilityRole="link">
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: t.fontSize['2xs'],
                                color: t.color.accent,
                                textDecorationLine: 'underline',
                              }}
                            >
                              {p.url}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  )
                })}

                <View style={{ flexDirection: 'row' }}>
                  <Button
                    size="sm"
                    disabled={importing || selectedCount === 0 || project === undefined}
                    onPress={() => void runImport()}
                  >
                    {importing ? 'Importing…' : `Import selected (${String(selectedCount)})`}
                  </Button>
                </View>
              </>
            )}

            {importError !== null && (
              <Text
                accessibilityRole="alert"
                style={{ fontSize: t.fontSize.xs, color: t.color.crit }}
              >
                {importError}
              </Text>
            )}

            {importedCount !== null && importError === null && (
              <Text style={{ fontSize: t.fontSize.xs, color: t.color.good, fontWeight: '600' }}>
                {String(importedCount)} task{importedCount === 1 ? '' : 's'} imported.
              </Text>
            )}
          </View>
        )}
      </View>
    </Card>
  )
}
