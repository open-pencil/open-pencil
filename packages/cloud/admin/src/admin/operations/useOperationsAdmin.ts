import { operationsQueryOptions } from '#admin/app/query/options'
import { useQuery } from '@tanstack/vue-query'

export function useOperationsAdmin() {
  return useQuery(operationsQueryOptions())
}
