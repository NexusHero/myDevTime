import { QueryClient } from '@tanstack/react-query'

/**
 * The app's TanStack Query client (ADR-0047) — the server-state manager for
 * non-PowerSync reads (billing/AI/connector endpoints). Sensible defaults for a
 * cross-platform app: retry transient failures, treat data as fresh briefly so
 * sibling screens dedupe, and don't refetch on window focus (noisy on a desktop
 * web build; offline-first data comes from local SQLite, not here).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}
