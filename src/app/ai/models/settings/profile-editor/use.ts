import { computed, reactive, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import { refreshAIProviderStatus } from '@/app/ai/chat/storage'
import {
  aiModelSettings,
  createModelProfileDraft,
  modelConnectionUsageCount,
  modelProfile,
  removeModelProfile,
  saveModelProfileDraft,
  setModelConnectionAPIKey
} from '@/app/ai/models'
import type { ModelPickerLabels } from '@/app/ai/models/picker/options'

import { useProfileConnection } from './connection'
import { useProfileModelSelection } from './selection'

interface ProfileEditorOptions {
  profileId?: string
  keyInput: Ref<string>
  labels: Readonly<Ref<ModelPickerLabels & { customModel: string }>>
}

export function useModelProfileEditor({ profileId, keyInput, labels: ai }: ProfileEditorOptions) {
  const draft = reactive(createModelProfileDraft(profileId))

  const selection = useProfileModelSelection(draft, ai)
  const {
    providerDef,
    isACP,
    isHarness,
    customModelSelected,
    supportsReasoningEffort,
    providerDisplayName,
    modelOptions,
    selectedModelValue,
    knownModel,
    knownCapabilities,
    outputTokenRecommendation,
    modelDisplayName,
    toolsEnabled,
    visionEnabled,
    applyKnownModelMetadata
  } = selection

  const saveError = ref<string | null>(null)

  const {
    connectionTestStatus,
    connectionTestReason,
    hasExistingKey,
    canTest,
    resetConnectionTest,
    refreshKeyStatus,
    clearKey,
    testConnection
  } = useProfileConnection({ draft, keyInput, providerDef, isACP, isHarness, customModelSelected })

  const canDelete = computed(() => Boolean(profileId) && aiModelSettings.value.models.length > 1)
  const canSave = computed(
    () =>
      Boolean(draft.name.trim()) &&
      (isACP.value ||
        (customModelSelected.value
          ? Boolean(draft.customModelID.trim())
          : Boolean(draft.modelID.trim())))
  )

  function updateProvider(id: AIProviderID) {
    selection.updateProvider(id)
    keyInput.value = ''
    resetConnectionTest()
    void refreshKeyStatus()
  }

  function updateModel(id: string) {
    selection.updateModel(id)
    resetConnectionTest()
  }

  async function save(): Promise<boolean> {
    saveError.value = null

    try {
      applyKnownModelMetadata()
      if (!draft.name.trim()) draft.name = modelDisplayName.value || providerDisplayName.value
      const profile = saveModelProfileDraft(draft)
      if (keyInput.value.trim()) {
        await setModelConnectionAPIKey(profile.connectionId, keyInput.value)
        await refreshAIProviderStatus()
        keyInput.value = ''
      }
      return true
    } catch (reason) {
      saveError.value = reason instanceof Error ? reason.message : String(reason)
      return false
    }
  }

  async function remove(): Promise<boolean> {
    if (!profileId) return false

    const profile = modelProfile(profileId)
    if (profile && modelConnectionUsageCount(profile.connectionId) === 1) {
      await setModelConnectionAPIKey(profile.connectionId, '')
    }
    removeModelProfile(profileId)
    await refreshAIProviderStatus()

    return true
  }

  watch(
    () => [draft.customBaseURL, draft.customModelID, draft.customAPIType, draft.modelID],
    resetConnectionTest
  )

  void refreshKeyStatus()

  return {
    draft,
    providerDef,
    isACP,
    isHarness,
    supportsReasoningEffort,
    providerDisplayName,
    modelOptions,
    selectedModelValue,
    knownModel,
    knownCapabilities,
    outputTokenRecommendation,
    modelDisplayName,
    hasExistingKey,
    canDelete,
    toolsEnabled,
    visionEnabled,
    canSave,
    canTest,
    connectionTestStatus,
    connectionTestReason,
    saveError,
    updateProvider,
    updateModel,
    save,
    clearKey,
    testConnection,
    remove
  }
}
