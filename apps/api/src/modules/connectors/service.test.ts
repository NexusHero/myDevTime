import { describe, expect, it } from 'vitest'
import { scopesForGrantedCapabilities } from './registry.js'
import { buildAuthorizeUrl, clientIdEnvKey, isConfigured } from './service.js'

/**
 * The pure connector logic (M3, ADR-0032/0033): least-privilege scopes, honest
 * "configured" detection, and the OAuth authorize-URL builder. No DB, no network.
 */
describe('scopesForGrantedCapabilities', () => {
  it('RequestsNoScopesWithoutConsent', () => {
    expect(scopesForGrantedCapabilities('github', [])).toEqual([])
  })
  it('RequestsOnlyReadForInboundConsent', () => {
    expect(scopesForGrantedCapabilities('github', ['inbound'])).toEqual(['repo:read'])
  })
  it('AddsAWriteScopeOnlyWhenOutboundIsGranted', () => {
    const scopes = scopesForGrantedCapabilities('github', ['inbound', 'outbound'])
    expect(scopes).toContain('repo:read')
    expect(scopes).toContain('repo:write')
  })
})

describe('isConfigured', () => {
  it('IsTrueOnlyWhenTheClientIdEnvIsSet', () => {
    expect(isConfigured('jira', {})).toBe(false)
    expect(isConfigured('jira', { [clientIdEnvKey('jira')]: 'id-123' })).toBe(true)
  })
})

describe('buildAuthorizeUrl', () => {
  it('IsNullWhenTheProviderIsNotConfigured', () => {
    expect(
      buildAuthorizeUrl('github', {}, { redirectUri: 'https://app/cb', state: 's', granted: [] }),
    ).toBeNull()
  })
  it('BuildsAScopedAuthorizeUrlWhenConfigured', () => {
    const url = buildAuthorizeUrl(
      'github',
      { [clientIdEnvKey('github')]: 'cid' },
      { redirectUri: 'https://app/cb', state: 'xyz', granted: ['inbound'] },
    )
    expect(url).not.toBeNull()
    const parsed = new URL(url ?? '')
    expect(parsed.origin + parsed.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(parsed.searchParams.get('client_id')).toBe('cid')
    expect(parsed.searchParams.get('state')).toBe('xyz')
    expect(parsed.searchParams.get('scope')).toBe('repo:read')
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app/cb')
  })
})
