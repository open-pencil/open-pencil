import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { emailQueryOptions } from '#admin/app/query/options'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'

export function useEmailAdmin() {
  const queryClient = useQueryClient()
  const messages = useQuery(emailQueryOptions())
  const regenerate = useMutation({
    mutationKey: ['cloud', 'admin', 'email', 'regenerate'],
    mutationFn: (id: string) => cloudAdminAPI.regenerateEmail(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cloudQueryKeys.email })
  })
  return { messages, regenerate }
}
