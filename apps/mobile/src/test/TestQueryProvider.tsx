import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Test-only wrapper providing a fresh TanStack Query client (ADR-0047) so render
 * tests can mount screens whose hooks call `useQuery`/`useMutation`. Retries are
 * off and each render gets an isolated client, so tests never wait on backoff or
 * leak cache between cases. Imported only from `*.test.tsx`.
 */
export function TestQueryProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
