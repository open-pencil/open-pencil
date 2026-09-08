import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { enrollmentQueryOptions } from '#admin/app/query/options'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'

export function useEnrollmentAdmin(status: Ref<string>) {
  const queryClient = useQueryClient()
  const records = useQuery(computed(() => enrollmentQueryOptions(status.value)))
  const review = useMutation({
    mutationKey: ['cloud', 'admin', 'enrollment', 'review'],
    mutationFn: (input: { id: string; action: 'approve' | 'reject' | 'revoke'; note?: string }) =>
      cloudAdminAPI.reviewEnrollment(input.id, input.action, input.note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cloudQueryKeys.enrollments.all })
  })
  return { records, review }
}
