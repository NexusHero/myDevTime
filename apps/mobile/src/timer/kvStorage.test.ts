// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'

// Node 22 has a global `localStorage` property that warns and returns undefined
// unless configured with native localStorage options. Replace it with a mock if it is undefined/broken.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (typeof localStorage === 'undefined' || !localStorage) {
  const store = new Map<string, string>()
  const localStorageMock: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  })
}

import {
  asyncKvStorage,
  memoryKvStorage,
  resolveKvStorage,
  webKvStorage,
  type AsyncStorageLike,
  type KvStorage,
} from './kvStorage.js'

const KEY = 'kvStorage.test.key'

afterEach(() => {
  localStorage.removeItem(KEY)
})

describe('webKvStorage', () => {
  it('SetThenGet_RoundTripsThroughLocalStorage', async () => {
    const kv = webKvStorage(localStorage)
    await kv.set(KEY, 'hello')
    expect(localStorage.getItem(KEY)).toBe('hello') // really localStorage-backed
    expect(await kv.get(KEY)).toBe('hello')
  })

  it('Remove_DeletesTheKey', async () => {
    const kv = webKvStorage(localStorage)
    await kv.set(KEY, 'x')
    await kv.remove(KEY)
    expect(await kv.get(KEY)).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('memoryKvStorage', () => {
  it('SetGetRemove_RoundTripsInMemoryOnly', async () => {
    const kv = memoryKvStorage()
    expect(await kv.get(KEY)).toBeNull()
    await kv.set(KEY, 'volatile')
    expect(await kv.get(KEY)).toBe('volatile')
    expect(localStorage.getItem(KEY)).toBeNull() // never touches localStorage
    await kv.remove(KEY)
    expect(await kv.get(KEY)).toBeNull()
  })

  it('TwoInstances_DoNotShareState', async () => {
    const a = memoryKvStorage()
    const b = memoryKvStorage()
    await a.set(KEY, 'a-only')
    expect(await b.get(KEY)).toBeNull()
  })
})

describe('asyncKvStorage', () => {
  it('DelegatesToTheAsyncStorageModule', async () => {
    const backing = new Map<string, string>()
    const fake: AsyncStorageLike = {
      getItem: k => Promise.resolve(backing.get(k) ?? null),
      setItem: (k, v) => {
        backing.set(k, v)
        return Promise.resolve()
      },
      removeItem: k => {
        backing.delete(k)
        return Promise.resolve()
      },
    }
    const kv = asyncKvStorage(fake)
    await kv.set(KEY, 'native')
    expect(backing.get(KEY)).toBe('native')
    expect(await kv.get(KEY)).toBe('native')
    await kv.remove(KEY)
    expect(await kv.get(KEY)).toBeNull()
  })
})

describe('resolveKvStorage', () => {
  it('WebStorageAvailable_ResolvesLocalStorageBackedStore', async () => {
    const kv = resolveKvStorage()
    await kv.set(KEY, 'web-wins')
    expect(localStorage.getItem(KEY)).toBe('web-wins')
  })

  it('NoWebStorage_ResolvesTheNativeStore', async () => {
    const native: KvStorage = memoryKvStorage()
    const kv = resolveKvStorage(
      () => null,
      () => native,
    )
    await kv.set(KEY, 'async-storage')
    expect(await native.get(KEY)).toBe('async-storage')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('NeitherWebNorNative_FallsBackToWorkingInMemoryStore', async () => {
    const kv = resolveKvStorage(
      () => null,
      () => null,
    )
    await kv.set(KEY, 'last-resort')
    expect(await kv.get(KEY)).toBe('last-resort')
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})
