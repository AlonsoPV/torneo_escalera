import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { Toaster } from '@/components/ui/sonner'
import { isAbortLike } from '@/lib/fetchWithTimeout'

function queryRetry(failureCount: number, error: unknown) {
  if (failureCount >= 1) return false
  if (isAbortLike(error)) return false
  return true
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60_000,
            gcTime: 10 * 60_000,
            refetchOnMount: false,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            retry: queryRetry,
          },
          mutations: {
            retry: queryRetry,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  )
}
