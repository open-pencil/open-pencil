import { useI18n } from '@open-pencil/vue'

import type { AIModelRole } from '@/app/ai/models/types'

/** The name and explanation of each model role, shared by model settings and guided setup. */
export function useModelRoleLabels() {
  const { ai } = useI18n()
  return (role: AIModelRole): { label: string; description: string } => {
    const roles = {
      design: [ai.value.modelRoleDesign, ai.value.modelRoleDesignDescription],
      review: [ai.value.modelRoleReview, ai.value.modelRoleReviewDescription],
      fast: [ai.value.modelRoleFast, ai.value.modelRoleFastDescription],
      vision: [ai.value.modelRoleVision, ai.value.modelRoleVisionDescription]
    } as const
    const [label, description] = roles[role]
    return { label, description }
  }
}
