import { compact } from 'es-toolkit/array'
import { computed } from 'vue'

import { providerKind } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import {
  aiModelSettings,
  designModelProfiles,
  modelConnection,
  setModelRoleAssignment
} from '@/app/ai/models'
import type { AIModelProfile, AIModelProfileId } from '@/app/ai/models'
import { profileModelName } from '@/app/ai/models/profile-model-name'
import { modelProviderName } from '@/app/ai/models/provider-name'
import { openSettingsDialog } from '@/app/settings/dialog'

/** One profile the Design role can take, as the composer's model controls list it. */
export interface DesignProfileOption {
  value: AIModelProfileId
  label: string
  /** The profile's model and where it runs. */
  metadata: string
  takesImages: boolean
}

/**
 * The profiles the chat's Design role can take, the one it has, and the way to settings, which
 * the composer's profile select and an agent's model menu both offer.
 */
export function useDesignProfiles() {
  const { ai } = useI18n()

  /** The profile's model and where it runs; an agent profile that names no model leaves it to the agent. */
  function profileMetadata(profile: AIModelProfile): string {
    const providerID = modelConnection(profile.connectionId)?.providerID
    const agent = providerID !== undefined && providerKind(providerID) !== 'api'
    return compact([
      profileModelName(profile) || (agent ? ai.value.agentDefaultModel : ''),
      providerID && modelProviderName(providerID)
    ]).join(' · ')
  }

  const profiles = computed<DesignProfileOption[]>(() =>
    designModelProfiles().map((profile) => ({
      value: profile.id,
      label: profile.name,
      metadata: profileMetadata(profile),
      takesImages: profile.capabilities.includes('vision')
    }))
  )

  const selectedProfileId = computed({
    get: () => aiModelSettings.value.assignments.design,
    set: (profileId: AIModelProfileId) => setModelRoleAssignment('design', profileId)
  })

  function profileOf(id: AIModelProfileId): DesignProfileOption | undefined {
    return profiles.value.find((profile) => profile.value === id)
  }

  function manageModels(): void {
    openSettingsDialog('ai')
  }

  return { profiles, selectedProfileId, profileOf, manageModels }
}
