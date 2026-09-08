import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { usersQueryOptions } from '#admin/app/query/options'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'

export function useUsersAdmin(search: Ref<string>) {
  const queryClient = useQueryClient()
  const users = useQuery(computed(() => usersQueryOptions(search.value)))
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cloud', 'admin', 'users'] })
  const action = useMutation({
    mutationKey: ['cloud', 'admin', 'users', 'action'],
    mutationFn: (input: {
      action: 'ban' | 'unban' | 'revoke-sessions'
      userId: string
      reason?: string
    }) => cloudAdminAPI.userAction(input.action, input.userId, input.reason),
    onSuccess: refresh
  })
  const setAdmin = useMutation({
    mutationKey: ['cloud', 'admin', 'users', 'set-admin'],
    mutationFn: (input: { userId: string; enabled: boolean }) =>
      cloudAdminAPI.setAdmin(input.userId, input.enabled),
    onSuccess: refresh
  })
  return { users, action, setAdmin, key: cloudQueryKeys.users(search.value) }
}
