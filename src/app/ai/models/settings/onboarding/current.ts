import type { AIModelRoleAssignment, AIModelSettings } from '@/app/ai/models/types'

import { isUnconfiguredModelSettings } from './apply'
import type { CurrentOnboardingModels, PlannedModel, PlannedRole } from './plan'

function configuredModel(
  settings: AIModelSettings,
  assignment: AIModelRoleAssignment
): PlannedModel | null {
  const profile =
    assignment && assignment !== 'design'
      ? settings.models.find((candidate) => candidate.id === assignment)
      : undefined
  const connection = settings.connections.find(
    (candidate) => candidate.id === profile?.connectionId
  )
  if (!profile || !connection) return null
  return {
    providerID: connection.providerID,
    modelID: profile.customModelID || profile.modelID,
    name: profile.name,
    capabilities: [...profile.capabilities],
    profileId: profile.id
  }
}

function configuredRole(settings: AIModelSettings, assignment: AIModelRoleAssignment): PlannedRole {
  return assignment === 'design' ? 'design' : configuredModel(settings, assignment)
}

/** What each role uses now, so guided setup keeps models configured by hand. */
export function currentOnboardingModels(settings: AIModelSettings): CurrentOnboardingModels {
  if (isUnconfiguredModelSettings(settings)) {
    return { configured: false, design: null, vision: null, review: null, fast: null }
  }
  const { design, vision, review, fast } = settings.assignments
  return {
    configured: true,
    design: configuredModel(settings, design),
    vision: configuredRole(settings, vision),
    review: configuredRole(settings, review),
    fast: configuredRole(settings, fast)
  }
}
