// @vitest-environment jsdom
// The web path reads/writes `localStorage`, which needs a DOM.
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearActivitySamples,
  loadActivitySamples,
  mergeBySource,
  saveActivitySamples,
} from './activityStore.js'
import { ensureLocalStorage } from '../test/localStorage.js'

ensureLocalStorage()

afterEach(() => {
  localStorage.clear()
})

describe('mergeBySource', () => {
  it('SumsBySource_DropsNonPositive_SortsByName', () => {
    expect(
      mergeBySource([
        { source: 'VS Code', ms: 40 },
        { source: 'Active', ms: 10 },
        { source: 'Active', ms: 20 },
        { source: 'Idle', ms: 0 },
      ]),
    ).toEqual([
      { source: 'Active', ms: 30 },
      { source: 'VS Code', ms: 40 },
    ])
  })
})

describe('activityStore (local session buffer)', () => {
  it('LoadsEmpty_UntilSaved', () => {
    expect(loadActivitySamples()).toEqual([])
  })

  it('PersistsMergedSamples_UnderOneNamespacedKey', () => {
    saveActivitySamples([
      { source: 'Active', ms: 10 },
      { source: 'Active', ms: 20 },
    ])
    expect(loadActivitySamples()).toEqual([{ source: 'Active', ms: 30 }])
    expect(localStorage.getItem('mydevtime.autotracker.session')).toContain('Active')
  })

  it('Clear_ForgetsTheBuffer', () => {
    saveActivitySamples([{ source: 'Active', ms: 10 }])
    clearActivitySamples()
    expect(loadActivitySamples()).toEqual([])
  })

  it('MalformedBlob_LoadsAsEmpty', () => {
    localStorage.setItem('mydevtime.autotracker.session', '{not json')
    expect(loadActivitySamples()).toEqual([])
  })
})
