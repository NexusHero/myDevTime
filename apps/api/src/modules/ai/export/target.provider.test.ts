import { describe, expect, it } from 'vitest'
import type { FactoryProvider } from '@nestjs/common'
import {
  createExportTargetResolver,
  exportTargetProvider,
  type ExportTargetResolver,
} from './target.provider.js'
import { JiraExportTarget } from './jira-target.js'
import { LinearExportTarget } from './linear-target.js'
import { SlackExportTarget } from './slack-target.js'
import { NullExportTarget } from './null-export.js'

/**
 * The per-target registry (REQ-035, #44 · ADR-0035): a request's target name resolves to the live
 * adapter only when that tool's environment is fully configured, and to the honest
 * `NullExportTarget` otherwise — including unknown names — so runs degrade to recorded
 * `unavailable` outcomes (ADR-0005). No real network calls: resolution never sends.
 */

const fullEnv: NodeJS.ProcessEnv = {
  EXPORT_JIRA_BASE_URL: 'https://acme.atlassian.net',
  EXPORT_JIRA_EMAIL: 'dev@acme.test',
  EXPORT_JIRA_API_TOKEN: 'jira-token',
  EXPORT_JIRA_PROJECT_KEY: 'DEV',
  EXPORT_LINEAR_API_KEY: 'lin_api_key',
  EXPORT_LINEAR_TEAM_ID: 'team-123',
  EXPORT_SLACK_BOT_TOKEN: 'xoxb-test-token',
  EXPORT_SLACK_CHANNEL: 'C012AB3CD',
}

describe('createExportTargetResolver', () => {
  it('UnconfiguredEnv_ResolvesEveryNameToTheNullTarget', () => {
    const resolve = createExportTargetResolver({})
    for (const name of ['jira', 'linear', 'slack']) {
      expect(resolve(name)).toBeInstanceOf(NullExportTarget)
    }
  })

  it('ConfiguredEnv_ResolvesEachNameToItsLiveAdapter', () => {
    const resolve = createExportTargetResolver(fullEnv)
    expect(resolve('jira')).toBeInstanceOf(JiraExportTarget)
    expect(resolve('linear')).toBeInstanceOf(LinearExportTarget)
    expect(resolve('slack')).toBeInstanceOf(SlackExportTarget)
  })

  it('PartialConfig_OnlyTheConfiguredToolGoesLive', () => {
    const resolve = createExportTargetResolver({
      EXPORT_LINEAR_API_KEY: 'lin_api_key',
      EXPORT_LINEAR_TEAM_ID: 'team-123',
    })
    expect(resolve('linear')).toBeInstanceOf(LinearExportTarget)
    expect(resolve('jira')).toBeInstanceOf(NullExportTarget)
    expect(resolve('slack')).toBeInstanceOf(NullExportTarget)
  })

  it('UnknownTargetName_ResolvesToTheNullTarget', () => {
    const resolve = createExportTargetResolver(fullEnv)
    expect(resolve('github')).toBeInstanceOf(NullExportTarget)
    expect(resolve('')).toBeInstanceOf(NullExportTarget)
  })

  it('ConfiguredAdapters_ReportAvailable_TheNullDoesNot', async () => {
    const resolve = createExportTargetResolver(fullEnv)
    await expect(resolve('jira').available()).resolves.toBe(true)
    await expect(createExportTargetResolver({})('jira').available()).resolves.toBe(false)
  })

  it('ProviderFactory_BindsAResolverFunction', () => {
    const factory = (exportTargetProvider as FactoryProvider<ExportTargetResolver>).useFactory
    const resolve = factory() as ExportTargetResolver
    expect(typeof resolve).toBe('function')
    expect(resolve('no-such-target')).toBeInstanceOf(NullExportTarget)
  })
})
