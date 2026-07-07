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
    const config = loadConfig({ NODE_ENV: 'production', PORT: '8080', LOG_LEVEL: 'warn' })

    expect(config.NODE_ENV).toBe('production')
    expect(config.PORT).toBe(8080)
    expect(config.LOG_LEVEL).toBe('warn')
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
