import { describe, expect, it } from 'vitest'
import { runExport } from './service.js'
import { NullExportTarget } from './null-export.js'
import {
  ExportUnavailableError,
  type ExportItem,
  type ExportResult,
  type ExportTargetPort,
} from './port.js'

const item = (over: Partial<ExportItem> = {}): ExportItem => ({
  dedupeKey: 'k1',
  title: 'Ship the report',
  confirmed: true,
  ...over,
})

/** A tiny in-memory export target for the seam tests — the live adapters are spike-gated. */
class FakeTarget implements ExportTargetPort {
  readonly target = 'jira' as const
  readonly sent: ExportItem[] = []
  constructor(
    private readonly up = true,
    private readonly result: ExportResult = { ok: true, externalId: 'JIRA-1' },
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  send(i: ExportItem): Promise<ExportResult> {
    if (!this.up) return Promise.reject(new ExportUnavailableError('jira'))
    this.sent.push(i)
    return Promise.resolve(this.result)
  }
}

describe('runExport', () => {
  it('SendsOnlyConfirmedItems', async () => {
    const target = new FakeTarget()
    const run = await runExport(
      target,
      [item({ dedupeKey: 'a' }), item({ dedupeKey: 'b', confirmed: false })],
      new Set(),
    )
    expect(target.sent.map(i => i.dedupeKey)).toEqual(['a'])
    expect(run.records.find(r => r.dedupeKey === 'b')?.outcome).toBe('unconfirmed')
    expect(run.sentCount).toBe(1)
  })

  it('SkipsAlreadyExportedKeys_idempotent', async () => {
    const target = new FakeTarget()
    const run = await runExport(target, [item({ dedupeKey: 'a' })], new Set(['a']))
    expect(target.sent).toEqual([])
    expect(run.records[0]?.outcome).toBe('duplicate')
    expect(run.sentCount).toBe(0)
  })

  it('SkipsDuplicateKeysWithinTheSameRun', async () => {
    const target = new FakeTarget()
    const run = await runExport(
      target,
      [item({ dedupeKey: 'a' }), item({ dedupeKey: 'a' })],
      new Set(),
    )
    expect(target.sent).toHaveLength(1)
    expect(run.records.map(r => r.outcome)).toEqual(['sent', 'duplicate'])
  })

  it('RecordsTheExternalResult', async () => {
    const target = new FakeTarget(true, { ok: true, externalId: 'LIN-9', url: 'https://x/LIN-9' })
    const run = await runExport(target, [item()], new Set())
    expect(run.records[0]?.result?.externalId).toBe('LIN-9')
  })

  it('UnavailableTarget_SendsNothing', async () => {
    const target = new FakeTarget(false)
    const run = await runExport(target, [item()], new Set())
    expect(target.sent).toEqual([])
    expect(run.records[0]?.outcome).toBe('unavailable')
    expect(run.sentCount).toBe(0)
  })

  it('NullTarget_IsAlwaysUnavailable', async () => {
    const run = await runExport(new NullExportTarget(), [item()], new Set())
    expect(run.records[0]?.outcome).toBe('unavailable')
  })

  it('FailedSend_IsRecordedFailed_notSent', async () => {
    const target = new FakeTarget(true, { ok: false, error: 'rate limited' })
    const run = await runExport(target, [item()], new Set())
    expect(run.records[0]?.outcome).toBe('failed')
    expect(run.sentCount).toBe(0)
  })
})
