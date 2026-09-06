import { computed, ref, watch, type Ref } from 'vue'

import {
  ACP_AGENTS,
  AI_PROVIDERS,
  type AIProviderID,
  type ModelOption
} from '@open-pencil/core/constants'

import type { AIModelProfileDraft, AIModelCapability } from '@/app/ai/models'
import { resolveModelsDevModel } from '@/app/ai/models/catalog'
import { useProviderModelCatalog } from '@/app/ai/models/catalog/use'
import { modelPickerOptions, type ModelPickerLabels } from '@/app/ai/models/picker/options'

export function useProfileModelSelection(
  draft: AIModelProfileDraft,
  ai: Readonly<Ref<ModelPickerLabels & { customModel: string }>>
) {
  const CUSTOM_MODEL_VALUE = '__custom__'
  const DEFAULT_MAX_OUTPUT_TOKENS = 16384
  const customModelSelected = ref(
    Boolean(draft.customModelID.trim()) || draft.providerID === 'harness:pi'
  )
  const catalogModel = ref<ModelOption | null>(null)

  const providerDef = computed(
    () => AI_PROVIDERS.find((provider) => provider.id === draft.providerID) ?? AI_PROVIDERS[0]
  )
  const catalogProviderID = computed(() => draft.providerID)
  const fallbackModels = computed(() => providerDef.value.models)
  const { models: availableModels } = useProviderModelCatalog(catalogProviderID, fallbackModels)
  const isACP = computed(() => draft.providerID.startsWith('acp:'))
  const isHarness = computed(() => draft.providerID === 'harness:pi')
  const supportsReasoningEffort = computed(() =>
    ['openai', 'openai-compatible', 'openrouter'].includes(draft.providerID)
  )
  const providerDisplayName = computed(() => {
    if (!isACP.value) return providerDef.value.name

    const agentID = draft.providerID.slice('acp:'.length)
    return ACP_AGENTS.find((agent) => agent.id === agentID)?.name ?? draft.providerID
  })
  const modelOptions = computed(() => {
    const options = modelPickerOptions(availableModels.value, providerDef.value.models, ai.value)
    if (providerDef.value.supportsCustomModel) {
      options.push({
        value: CUSTOM_MODEL_VALUE,
        label: ai.value.customModel,
        description: '',
        meta: undefined,
        group: ai.value.customModel
      })
    }
    return options
  })
  const selectedModelValue = computed(() =>
    customModelSelected.value ? CUSTOM_MODEL_VALUE : draft.modelID
  )
  const knownModel = computed(() => {
    if (isACP.value) return null
    if (draft.customModelID.trim()) return catalogModel.value
    return (
      catalogModel.value ??
      availableModels.value.find((model) => model.id === draft.modelID) ??
      null
    )
  })
  const knownCapabilities = computed<AIModelCapability[]>(() => [
    ...(knownModel.value?.capabilities ?? ['tools'])
  ])
  const outputTokenRecommendation = computed(
    () => knownModel.value?.recommendedMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
  )
  const modelDisplayName = computed(() => {
    const modelId = draft.customModelID.trim() || draft.modelID
    return availableModels.value.find((model) => model.id === modelId)?.name || modelId
  })
  const toolsEnabled = capabilityModel('tools')
  const visionEnabled = capabilityModel('vision')

  function capabilityModel(capability: AIModelCapability) {
    return computed({
      get: () => draft.capabilities.includes(capability),
      set: (enabled: boolean) => {
        if (enabled && !draft.capabilities.includes(capability)) draft.capabilities.push(capability)
        if (!enabled) {
          draft.capabilities = draft.capabilities.filter((value) => value !== capability)
        }
      }
    })
  }

  function effectiveModelID(): string {
    return customModelSelected.value ? draft.customModelID.trim() : draft.modelID.trim()
  }

  async function refreshCatalogModel(): Promise<void> {
    if (isACP.value) {
      catalogModel.value = null
      return
    }
    const providerID = draft.providerID
    const modelID = effectiveModelID()
    const resolved = await resolveModelsDevModel(providerID, modelID)
    if (providerID !== draft.providerID || modelID !== effectiveModelID()) return

    catalogModel.value = resolved
    applyKnownModelMetadata()
  }

  function applyKnownModelMetadata(): void {
    if (!knownModel.value) return

    draft.capabilities = [...knownCapabilities.value]
    draft.maxOutputTokens = outputTokenRecommendation.value
  }

  function updateProvider(providerID: AIProviderID): void {
    catalogModel.value = null
    draft.providerID = providerID
    draft.sourceConnectionId = null
    const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
    draft.modelID = provider?.defaultModel ?? ''
    catalogModel.value = provider?.models.find((model) => model.id === draft.modelID) ?? null
    draft.customModelID = ''
    customModelSelected.value = providerID === 'harness:pi'
    draft.customBaseURL = ''
    draft.customAPIType = 'completions'
    if (providerID.startsWith('acp:')) {
      draft.capabilities = ['tools']
      if (!draft.name.trim()) draft.name = providerDisplayName.value
    } else {
      applyKnownModelMetadata()
    }

    void refreshCatalogModel()
  }

  function updateModel(modelID: string): void {
    if (modelID === CUSTOM_MODEL_VALUE) {
      customModelSelected.value = true
      draft.customModelID = ''
      catalogModel.value = null

      return
    }
    draft.modelID = modelID
    catalogModel.value = availableModels.value.find((model) => model.id === modelID) ?? null
    customModelSelected.value = false
    draft.customModelID = ''
    applyKnownModelMetadata()
    void refreshCatalogModel()
    if (!draft.name.trim()) draft.name = modelDisplayName.value
  }

  watch(
    () => draft.customModelID,
    () => {
      if (customModelSelected.value) void refreshCatalogModel()
    }
  )

  void refreshCatalogModel()

  return {
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
    applyKnownModelMetadata,
    updateProvider,
    updateModel
  }
}
