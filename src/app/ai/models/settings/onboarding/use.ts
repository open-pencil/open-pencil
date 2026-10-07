import { computed, reactive, ref, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { refreshAIProviderStatus } from '@/app/ai/chat/storage'
import {
  aiModelSettings,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  setModelConnectionAPIKey
} from '@/app/ai/models'
import type { SettingsSaveResult } from '@/app/settings/save-result'

import { useOnboardingAgents } from './agents'
import { applyOnboardingPlan } from './apply'
import { existingOnboardingConnection, useOnboardingConnections } from './connections'
import { currentOnboardingModels } from './current'
import {
  isOnboardingAccess,
  planOnboarding,
  type OnboardingAccess,
  type OnboardingAnswers,
  type PlannedModel,
  uncoveredGoals
} from './plan'
import { useOnboardingRoles } from './roles'
import { useOnboardingSignIn } from './sign-in'

export const AI_SETUP_STEPS = ['goals', 'access', 'connect', 'review'] as const
export type AISetupStep = (typeof AI_SETUP_STEPS)[number]

/** Starts from what is already configured, so running setup again adjusts instead of resets. */
function initialAnswers(): OnboardingAnswers {
  const access = aiModelSettings.value.connections
    .map((connection) => connection.providerID)
    .filter(isOnboardingAccess)
    .filter((providerID) => existingOnboardingConnection(providerID))
  return {
    goals: aiModelSettings.value.assignments.vision === null ? ['design'] : ['design', 'vision'],
    access: [...new Set(access)],
    spending: 'existing'
  }
}

interface AIOnboardingOptions {
  /** Agents run as local processes, so only the desktop app offers them. */
  agentsAvailable?: boolean
}

export function useAIOnboarding({ agentsAvailable = IS_TAURI }: AIOnboardingOptions = {}) {
  const answers = reactive<OnboardingAnswers>(initialAnswers())
  const current = currentOnboardingModels(aiModelSettings.value)
  const configured = [current.design, current.vision, current.review, current.fast].filter(
    (model): model is PlannedModel => model !== null && model !== 'design'
  )
  const step = ref<AISetupStep>('goals')
  const busy = ref(false)
  const saveResult = ref<SettingsSaveResult | null>(null)

  const recommended = computed(() => planOnboarding(answers, { agentsAvailable, current }))
  const roles = useOnboardingRoles(recommended, configured)
  const { plan } = roles
  /** Requested goals nothing selected covers; setup offers OpenRouter for them. */
  const gaps = computed(() => uncoveredGoals(answers, { agentsAvailable, current }))
  /** Setup can finish once there is a design model, planned or already configured. */
  const hasDesign = computed(() => recommended.value.design !== null || current.design !== null)

  function plannedModel(providerID: OnboardingAccess): PlannedModel | null {
    const { design, vision, review, fast } = recommended.value
    return (
      [design, vision, review, fast].find(
        (model): model is PlannedModel =>
          model !== null && model !== 'design' && model.providerID === providerID
      ) ?? null
    )
  }

  const connections = useOnboardingConnections({ plannedModel })
  const { connection, ready, markKeySaved } = connections
  const signIn = useOnboardingSignIn(connections)
  const agents = useOnboardingAgents()
  // Look for installed agents when they are about to be connected, and again on return.
  watch(step, (current) => {
    if (current === 'connect') void agents.refreshAgents()
  })

  const canContinue = computed(() => {
    if (step.value === 'goals') return answers.goals.length > 0
    if (step.value === 'connect') {
      return hasDesign.value && recommended.value.connections.every(ready)
    }
    return true
  })

  function next(): void {
    const index = AI_SETUP_STEPS.indexOf(step.value)
    if (canContinue.value && index < AI_SETUP_STEPS.length - 1) {
      step.value = AI_SETUP_STEPS[index + 1]
    }
  }

  /** Returns false on the first step, where going back leaves setup. */
  function back(): boolean {
    const index = AI_SETUP_STEPS.indexOf(step.value)
    if (index <= 0) return false
    step.value = AI_SETUP_STEPS[index - 1]
    return true
  }

  async function apply(): Promise<SettingsSaveResult> {
    if (busy.value) return 'failed'
    busy.value = true
    saveResult.value = null
    let persisted = false
    try {
      // Copied first: closing setup clears entered keys while the saves below are pending.
      const keys = plan.value.connections.map(
        (providerID) => [providerID, connection(providerID).apiKey.trim()] as const
      )
      const details = Object.fromEntries(
        plan.value.connections.map((providerID) => {
          const { customBaseURL, customModelID } = connection(providerID)
          return [providerID, { customBaseURL, customModelID }]
        })
      )
      const { settings, connectionIds } = applyOnboardingPlan({
        settings: modelSettingsSnapshot(),
        plan: plan.value,
        details,
        createId: () => crypto.randomUUID()
      })
      replaceAIModelSettings(settings)
      // Applying again is idempotent, so a retry after a credential failure adds nothing.
      persisted = true
      for (const [providerID, key] of keys) {
        const connectionId = connectionIds[providerID]
        if (!key || !connectionId) continue
        await setModelConnectionAPIKey(connectionId, key)
        connection(providerID).apiKey = ''
        markKeySaved(connectionId)
      }
      await refreshAIProviderStatus()
      saveResult.value = 'saved'
    } catch {
      saveResult.value = persisted ? 'partial' : 'failed'
    } finally {
      busy.value = false
    }
    return saveResult.value
  }

  return {
    agentsAvailable,
    answers,
    step,
    recommended,
    plan,
    roles,
    gaps,
    hasDesign,
    busy,
    saveResult,
    canContinue,
    plannedModel,
    ...connections,
    ...signIn,
    ...agents,
    next,
    back,
    apply
  }
}
