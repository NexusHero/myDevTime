// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { memoryKvStorage, type KvStorage } from './kvStorage.js'
import {
  initTimerStore,
  loadTimerSession,
  saveTimerSession,
  timerSessionReady,
} from './timerStore.js'

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    let store: Record<string, string> = {}
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v
        },
        removeItem: (k: string) => {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete store[k]
        },
        clear: () => {
          store = {}
        },
      },
    })
  }
})

afterEach(async () => {
  await initTimerStore() // restore the default (localStorage-backed) store
  saveTimerSession(null)
})

describe('timerStore', () => {
  it('SaveThenLoad_RoundTripsThePausedSession', () => {
    saveTimerSession({
      accumulatedMs: 1_800_000,
      pausedInput: { projectId: 'p1', note: 'x' },
      pausedSinceMs: 1_700_000_000_000,
    })
    expect(loadTimerSession()).toEqual({
      accumulatedMs: 1_800_000,
      pausedInput: { projectId: 'p1', note: 'x' },
      pausedSinceMs: 1_700_000_000_000,
    })
  })

  it('LoadWithNothingStored_ReturnsNull', () => {
    expect(loadTimerSession()).toBeNull()
  })

  it('SaveNull_ClearsThePersistedSession', () => {
    saveTimerSession({ accumulatedMs: 5_000, pausedInput: null })
    saveTimerSession(null)
    expect(loadTimerSession()).toBeNull()
  })

  it('LoadCorruptJson_ReturnsNullInsteadOfThrowing', async () => {
    localStorage.setItem('mydevtime.timer.session', '{not json')
    await initTimerStore() // re-hydrate the cache from the tampered backing store
    expect(loadTimerSession()).toBeNull()
  })

  it('LoadMalformedShape_FallsBackToSafeDefaults', async () => {
    localStorage.setItem('mydevtime.timer.session', JSON.stringify({ accumulatedMs: 'nope' }))
    await initTimerStore()
    expect(loadTimerSession()).toEqual({ accumulatedMs: 0, pausedInput: null, pausedSinceMs: null })
  })

  it('SaveWritesThroughToTheBackingStore_NotJustTheCache', async () => {
    saveTimerSession({ accumulatedMs: 60_000, pausedInput: null, pausedSinceMs: null })
    await timerSessionReady()
    expect(localStorage.getItem('mydevtime.timer.session')).toBe(
      JSON.stringify({ accumulatedMs: 60_000, pausedInput: null, pausedSinceMs: null }),
    )
  })

  it('LoadBeforeAsyncHydration_IsNull_ButValueAfterReady', async () => {
    // The native contract the useTimer hook relies on: while an async store's `get` is still
    // pending, the cache is null; only after `timerSessionReady()` resolves is the stored session
    // readable. Reading before awaiting would drop a paused/banked session (the reviewed bug).
    const durable = memoryKvStorage()
    await initTimerStore(durable)
    saveTimerSession({ accumulatedMs: 99_000, pausedInput: { note: 'x' }, pausedSinceMs: 1_700 })

    const stored = await durable.get('mydevtime.timer.session')
    let resolveGet!: (v: string | null) => void
    const pending = new Promise<string | null>(resolve => {
      resolveGet = resolve
    })
    const slow: KvStorage = {
      get: () => pending,
      set: durable.set.bind(durable),
      remove: durable.remove.bind(durable),
    }
    const ready = initTimerStore(slow) // "restart" against the slow store — hydration pending
    expect(loadTimerSession()).toBeNull() // cache not hydrated yet
    resolveGet(stored) // the AsyncStorage read lands
    await ready
    expect(loadTimerSession()).toEqual({
      accumulatedMs: 99_000,
      pausedInput: { note: 'x' },
      pausedSinceMs: 1_700,
    })
  })

  it('RoundTripThroughInjectedSeam_SurvivesRehydration', async () => {
    // Simulate the native path: an async KvStorage that outlives the "app process"
    // (the cache). Re-initialising from the same store is the restart.
    const durable = memoryKvStorage()
    await initTimerStore(durable)
    saveTimerSession({
      accumulatedMs: 42_000,
      pausedInput: { note: 'seam' },
      pausedSinceMs: 1_700_000_000_000,
    })
    await initTimerStore(durable) // "restart": wipe the cache, hydrate from the store
    expect(loadTimerSession()).toEqual({
      accumulatedMs: 42_000,
      pausedInput: { note: 'seam' },
      pausedSinceMs: 1_700_000_000_000,
    })
  })
})
