import { computed, ref, type Ref } from 'vue'

import { aiModelSettings } from '@/app/ai/models'
import { useSettingsValidation } from '@/app/settings/validation/use'

import { modelProfileSchema, type ModelProfileValidationMessages } from './schema'
import type { useModelProfileEditor } from './use'

export function useModelProfileFeedback(
  profile: ReturnType<typeof useModelProfileEditor>,
  keyInput: Readonly<Ref<string>>,
  messages: Readonly<Ref<ModelProfileValidationMessages>>
) {
  const testing = ref(false)
  const providerKind = computed(() => {
    if (profile.isACP.value) return 'acp'
    if (profile.isCloud.value) return 'cloud'
    return profile.isHarness.value ? 'harness' : 'api'
  })
  const values = computed(() => ({
    name: profile.draft.name,
    modelID: profile.draft.modelID,
    customModelID: profile.draft.customModelID,
    baseURL: profile.draft.customBaseURL,
    credential: Boolean(keyInput.value.trim() || profile.hasExistingKey.value),
    cloudWorkspace: profile.draft.cloudWorkspaceId ?? '',
    tools: (profile.knownModel.value
      ? profile.knownCapabilities.value
      : profile.draft.capabilities
    ).includes('tools')
  }))
  const schema = computed(() =>
    modelProfileSchema(
      {
        customModel: profile.customModelSelected.value,
        intent: testing.value ? 'test' : 'save',
        providerKind: providerKind.value,
        supportsCustomBaseURL: Boolean(profile.providerDef.value.supportsCustomBaseURL),
        design: profile.draft.profileId === aiModelSettings.value.assignments.design
      },
      messages.value
    )
  )
  const validation = useSettingsValidation(values, schema)
  return {
    ...validation,
    async validate(intent: 'save' | 'test') {
      testing.value = intent === 'test'
      return validation.validate()
    }
  }
}
