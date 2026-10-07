import { computed, ref, type ComputedRef } from 'vue'

import { AI_MODEL_ROLES, type AIModelRole } from '@/app/ai/models/types'

import {
  planConnections,
  roleChoiceKey,
  roleOptions,
  type OnboardingPlan,
  type PlannedModel,
  type PlannedRole
} from './plan'

/** The person's model choices per role on top of the recommended plan. */
export function useOnboardingRoles(
  recommended: ComputedRef<OnboardingPlan>,
  configured: PlannedModel[]
) {
  const choices = ref<Partial<Record<AIModelRole, string>>>({})

  function options(role: AIModelRole): PlannedRole[] {
    return roleOptions(role, recommended.value, configured)
  }

  function chosen(role: AIModelRole): PlannedRole {
    const key = choices.value[role]
    const option =
      key === undefined
        ? undefined
        : options(role).find((candidate) => roleChoiceKey(candidate) === key)
    return option === undefined ? recommended.value[role] : option
  }

  /** The recommended plan with the person's choices applied; choices that no longer fit are dropped. */
  const plan = computed<OnboardingPlan>(() => {
    const design = chosen('design')
    const roles = {
      design: design === 'design' ? null : design,
      vision: chosen('vision'),
      review: chosen('review'),
      fast: chosen('fast')
    }
    return { ...roles, connections: planConnections(roles) }
  })

  const isRecommended = computed(() =>
    AI_MODEL_ROLES.every(
      (role) => roleChoiceKey(plan.value[role]) === roleChoiceKey(recommended.value[role])
    )
  )

  function choose(role: AIModelRole, key: string): void {
    choices.value = { ...choices.value, [role]: key }
  }

  function useRecommended(): void {
    choices.value = {}
  }

  return { plan, options, choose, useRecommended, isRecommended }
}
