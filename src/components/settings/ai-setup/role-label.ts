import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import { isOnboardingAgent, type PlannedRole } from '@/app/ai/models/settings/onboarding/plan'
import type { AIModelRole } from '@/app/ai/models/types'

/** Labels for the roles and the choices guided setup offers for them. */
export function useRoleLabels() {
  const { ai } = useI18n()

  function choiceLabel(choice: PlannedRole): string {
    if (choice === 'design') return ai.value.modelRoleUseDesign
    if (choice === null) return ai.value.noModel
    const provider = modelProviderName(choice.providerID)
    if (isOnboardingAgent(choice.providerID)) return `${provider} · ${ai.value.aiSetupAgentModel}`
    return choice.modelID && choice.name !== provider ? `${choice.name} · ${provider}` : provider
  }

  function roleLabel(role: AIModelRole): { label: string; description: string } {
    const roles = {
      design: [ai.value.modelRoleDesign, ai.value.modelRoleDesignDescription],
      vision: [ai.value.modelRoleVision, ai.value.modelRoleVisionDescription],
      review: [ai.value.modelRoleReview, ai.value.modelRoleReviewDescription],
      fast: [ai.value.modelRoleFast, ai.value.modelRoleFastDescription]
    } as const
    const [label, description] = roles[role]
    return { label, description }
  }

  return { choiceLabel, roleLabel }
}
