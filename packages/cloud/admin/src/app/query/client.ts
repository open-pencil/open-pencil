import { CloudAdminAPIError } from '#admin/api/client'
import { QueryClient } from '@tanstack/vue-query'

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (!(error instanceof CloudAdminAPIError)) return false
  return error.kind === 'network' || error.kind === 'timeout'
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30_000,
      refetchOnWindowFocus: true
    },
    mutations: { retry: false }
  }
})
