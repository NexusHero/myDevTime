// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import TestRenderer, { act } from 'react-test-renderer'
import { TestQueryProvider } from '../test/TestQueryProvider.js'

/**
 * Regression for the audit finding H-1: `useCatalog` and `useClientsOpen` used to
 * key their TanStack Query cache on `base ?? 'demo'` alone. React Query dedupes by
 * query key, so two hooks sharing that key on the same screen (ProjectsScreen calls
 * both) collapsed into ONE cache entry — the catalog and the open-billable rollup
 * cross-contaminated: a `ClientsOpen` reader could receive a `Client[]` (and crash
 * on `.clients`), or vice versa. Each hook must now namespace its key so the two
 * live requests stay independent. An API base is configured so both take the live
 * path, and the mocked fetchers return deliberately different shapes.
 */
vi.mock('../config', () => ({ apiBaseUrl: 'https://api.test' }))

const CATALOG = [{ id: 'catalog-marker', name: 'From Catalog', projects: [] }]
const OPEN = {
  clients: [{ clientId: 'open-marker', openMs: 1, openMinor: 2 }],
  currencyCode: 'EUR',
}

vi.mock('../api/tracking.js', () => ({
  fetchCatalog: () => Promise.resolve(CATALOG),
}))
vi.mock('../api/invoicing.js', () => ({
  fetchClientsOpen: () => Promise.resolve(OPEN),
}))

// Imported after the mocks so the hooks pick up the mocked config + fetchers.
const { useCatalog } = await import('../screens/useCatalog.js')
const { useClientsOpen } = await import('./useClientsOpen.js')

const result: { catalog: unknown; open: unknown } = { catalog: null, open: null }

function Probe(): null {
  // Both hooks on one render — exactly the ProjectsScreen shape that collided.
  result.catalog = useCatalog().data
  result.open = useClientsOpen().data
  return null
}

describe('useCatalog / useClientsOpen — query-key isolation', () => {
  it('DoNotShareACacheEntry_WhenBothRunLive', async () => {
    await act(async () => {
      TestRenderer.create(
        <TestQueryProvider>
          <Probe />
        </TestQueryProvider>,
      )
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // Each hook gets its own shape back — no cross-contamination.
    expect(result.catalog).toEqual(CATALOG)
    expect(result.open).toEqual(OPEN)
  })
})
