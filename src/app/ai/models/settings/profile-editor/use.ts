import { tryOnScopeDispose } from '@vueuse/core'
import { isEqual } from 'es-toolkit'
import { computed, reactive, ref, toRaw, watch } from 'vue'
import type { Ref } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'

import { refreshAIProviderStatus } from '@/app/ai/chat/storage'
import {
  canRemoveModelProfile,
  createModelProfileDraft,
  modelConnectionUsageCount,
  modelProfile,
  removeModelProfile,
  saveModelProfileDraft,
  setModelConnectionAPIKey
} from '@/app/ai/models'
import type { ModelPickerLabels } from '@/app/ai/models/picker/options'
import type { SettingsSaveResult } from '@/app/settings/save-result'

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
    supportsThinking,
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
  const saveResult = ref<SettingsSaveResult | null>(null)
  const busy = ref(false)
  const initialDraft = structuredClone(toRaw(draft))
  tryOnScopeDispose(() => {
    keyInput.value = ''
  })

  const {
    connectionTestStatus,
    connectionTestReason,
    hasExistingKey,
    resetConnectionTest,
    refreshKeyStatus,
    keyCleared,
    clearKey: stageKeyRemoval,
    testConnection
  } = useProfileConnection({ draft, keyInput })

  const dirty = computed(
    () => !isEqual(draft, initialDraft) || keyInput.value.length > 0 || keyCleared.value
  )

  const canDelete = computed(() => (profileId ? canRemoveModelProfile(profileId) : false))

  function updateProvider(id: AIProviderID) {
    selection.updateProvider(id)
    keyCleared.value = false
    keyInput.value = ''
    resetConnectionTest()
    void refreshKeyStatus()
  }

  function updateModel(id: string) {
    selection.updateModel(id)
    resetConnectionTest()
  }

  function clearKey() {
    if (busy.value) return
    saveError.value = null
    stageKeyRemoval()
  }

  async function save(): Promise<SettingsSaveResult> {
    if (busy.value) return 'failed'
    busy.value = true
    saveError.value = null
    saveResult.value = null
    let persisted = false

    try {
      applyKnownModelMetadata()
      if (!draft.name.trim()) draft.name = modelDisplayName.value || providerDisplayName.value
      const profile = saveModelProfileDraft(draft)
      persisted = true
      // A credential failure must not create another profile on retry.
      draft.profileId = profile.id
      draft.sourceConnectionId = profile.connectionId
      if (keyInput.value.trim() || keyCleared.value) {
        await setModelConnectionAPIKey(profile.connectionId, keyInput.value)
        await refreshAIProviderStatus()
        keyInput.value = ''
      }
      saveResult.value = 'saved'
      return 'saved'
    } catch (reason) {
      saveError.value = reason instanceof Error ? reason.message : String(reason)
      saveResult.value = persisted ? 'partial' : 'failed'
      return saveResult.value
    } finally {
      busy.value = false
    }
  }

  async function remove(): Promise<boolean> {
    if (!profileId || busy.value || !canRemoveModelProfile(profileId)) return false
    busy.value = true
    saveError.value = null
    try {
      const profile = modelProfile(profileId)
      if (profile && modelConnectionUsageCount(profile.connectionId) === 1) {
        await setModelConnectionAPIKey(profile.connectionId, '')
      }
      removeModelProfile(profileId)
      await refreshAIProviderStatus()
      return modelProfile(profileId) === null
    } catch (reason) {
      saveError.value = reason instanceof Error ? reason.message : String(reason)
      return false
    } finally {
      busy.value = false
    }
  }

  watch(
    () => [draft.customBaseURL, draft.customModelID, draft.customAPIType, draft.modelID],
    resetConnectionTest
  )

  void refreshKeyStatus()

  return {
    draft,
    dirty,
    busy,
    providerDef,
    isACP,
    isHarness,
    supportsThinking,
    providerDisplayName,
    modelOptions,
    selectedModelValue,
    customModelSelected: selection.customModelSelected,
    knownModel,
    knownCapabilities,
    outputTokenRecommendation,
    modelDisplayName,
    hasExistingKey,
    canDelete,
    toolsEnabled,
    visionEnabled,
    connectionTestStatus,
    connectionTestReason,
    saveError,
    saveResult,
    updateProvider,
    updateModel,
    save,
    clearKey,
    testConnection,
    remove
  }
}
