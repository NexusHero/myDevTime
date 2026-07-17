import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'

/**
 * The async-resource hook — now a thin adapter over **TanStack Query** (ADR-0047).
 * The signature and `{ loading, error, data, reload }` shape are unchanged, so
 * every caller is untouched, but the engine underneath is React Query: sibling
 * screens sharing a `key` dedupe one request, results are cached, transient
 * failures retry, and there is no hand-rolled `useEffect`/liveness bookkeeping.
 * `key` is the query key; `fn` is the query function.
 */
export interface AsyncState<T> {
  readonly loading: boolean
  readonly error: Error | null
  readonly data: T | null
}

export interface AsyncResource<T> extends AsyncState<T> {
  readonly reload: () => void
}

export function useAsync<T>(fn: () => Promise<T>, key: string): AsyncResource<T> {
  const query = useQuery<T>({ queryKey: [key], queryFn: fn })
  const error =
    query.error == null
      ? null
      : query.error instanceof Error
        ? query.error
        : new Error(String(query.error))
  return {
    loading: query.isPending,
    error,
    data: query.data ?? null,
    reload: useCallback(() => {
      void query.refetch()
    }, [query.refetch]),
  }
}
