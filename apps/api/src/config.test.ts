import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig', () => {
  it('LoadConfig_EmptyEnv_AppliesDefaults', () => {
    const config = loadConfig({})

    expect(config.NODE_ENV).toBe('development')
    expect(config.PORT).toBe(3000)
    expect(config.LOG_LEVEL).toBe('info')
    expect(config.DATABASE_URL).toBeUndefined()
  })

  it('LoadConfig_ValidOverrides_ParsesAndCoerces', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'warn',
      AUTH_SECRET: 'x'.repeat(32),
      AUTH_BASE_URL: 'https://app.example.com',
    })

    expect(config.NODE_ENV).toBe('production')
    expect(config.PORT).toBe(8080)
    expect(config.LOG_LEVEL).toBe('warn')
  })

  it('LoadConfig_ProductionWithoutAuthSecret_Throws', () => {
    const act = (): unknown => loadConfig({ NODE_ENV: 'production' })

    expect(act).toThrow(/AUTH_SECRET/)
  })

  it('LoadConfig_DevWithoutAuthSecret_Ok', () => {
    const config = loadConfig({ NODE_ENV: 'development' })

    expect(config.AUTH_SECRET).toBeUndefined()
  })

  it('LoadConfig_ShortAuthSecret_Throws', () => {
    const act = (): unknown => loadConfig({ NODE_ENV: 'production', AUTH_SECRET: 'too-short' })

    expect(act).toThrow(/AUTH_SECRET/)
  })

  it('LoadConfig_EmailVerification_DefaultsOn', () => {
    expect(loadConfig({}).AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(true)
  })

  it('LoadConfig_EmailVerificationOffInDev_Ok', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
    })

    expect(config.AUTH_REQUIRE_EMAIL_VERIFICATION).toBe(false)
  })

  it('LoadConfig_EmailVerificationOffInProduction_Throws', () => {
    const act = (): unknown =>
      loadConfig({
        NODE_ENV: 'production',
        AUTH_SECRET: 'x'.repeat(32),
        AUTH_REQUIRE_EMAIL_VERIFICATION: 'false',
      })

    expect(act).toThrow(/AUTH_REQUIRE_EMAIL_VERIFICATION/)
  })

  it('LoadConfig_RateLimit_DefaultsOn', () => {
    expect(loadConfig({}).AUTH_RATE_LIMIT_ENABLED).toBe(true)
  })

  it('LoadConfig_RateLimitOffInDev_Ok', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      AUTH_RATE_LIMIT_ENABLED: 'false',
    })

    expect(config.AUTH_RATE_LIMIT_ENABLED).toBe(false)
  })

  it('LoadConfig_RateLimitOffInProduction_Throws', () => {
    const act = (): unknown =>
      loadConfig({
        NODE_ENV: 'production',
        AUTH_SECRET: 'x'.repeat(32),
        AUTH_BASE_URL: 'https://app.example.com',
        AUTH_RATE_LIMIT_ENABLED: 'false',
      })

    expect(act).toThrow(/AUTH_RATE_LIMIT_ENABLED/)
  })

  it('LoadConfig_InvalidPort_ThrowsListingTheField', () => {
    const act = (): unknown => loadConfig({ PORT: 'not-a-number' })

    expect(act).toThrow(/PORT/)
  })

  it('LoadConfig_InvalidDatabaseUrl_Throws', () => {
    const act = (): unknown => loadConfig({ DATABASE_URL: 'not a url' })

    expect(act).toThrow(/DATABASE_URL/)
  })

  it('LoadConfig_Result_IsFrozen', () => {
    const config = loadConfig({})

    expect(Object.isFrozen(config)).toBe(true)
  })
})
