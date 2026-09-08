import { auditQueryOptions } from '#admin/app/query/options'
import { useQuery } from '@tanstack/vue-query'

export function useAuditAdmin() {
  return useQuery(auditQueryOptions())
}
