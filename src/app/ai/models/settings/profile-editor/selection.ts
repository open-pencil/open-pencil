import { computed, ref, watch, type Ref } from 'vue'

import {
  acpAgentFor,
  AI_PROVIDERS,
  type AIProviderID,
  type ModelOption
} from '@open-pencil/core/constants'

import type { AIModelProfileDraft, AIModelCapability } from '@/app/ai/models'
import { resolveModelsDevModel } from '@/app/ai/models/catalog'
import { useProviderModelCatalog } from '@/app/ai/models/catalog/use'
import { modelPickerOptions, type ModelPickerLabels } from '@/app/ai/models/picker/options'
import { supportsThinkingLevel } from '@/app/ai/models/thinking'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'

import { HOST_AGENT_MODELS, useAgentModelSelection, type AgentModelSource } from './agent'
import { useCloudModelSelection } from './cloud'

export function useProfileModelSelection(
  draft: AIModelProfileDraft,
  ai: Readonly<Ref<ModelPickerLabels & { customModel: string; agentDefaultModel: string }>>,
  agents: AgentModelSource = HOST_AGENT_MODELS
) {
  const CUSTOM_MODEL_VALUE = '__custom__'
  /** An agent profile that names no model, which leaves the choice to the agent. */
  const AGENT_DEFAULT_VALUE = '__agent__'
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
  const { models: providerModels } = useProviderModelCatalog(catalogProviderID, fallbackModels)
  const cloud = useCloudModelSelection(draft, (modelID) => updateModel(modelID))
  const isACP = computed(() => draft.providerID.startsWith('acp:'))
  const agent = useAgentModelSelection(draft, agents)
  const availableModels = computed(() => {
    if (cloud.isCloud.value) return cloud.models.value
    return isACP.value ? agent.models.value : providerModels.value
  })
  const isHarness = computed(() => draft.providerID === 'harness:pi')
  const supportsThinking = computed(() => supportsThinkingLevel(draft.providerID))
  const providerDisplayName = computed(() => {
    if (!isACP.value) return providerDef.value.name
    return acpAgentFor(draft.providerID)?.name ?? draft.providerID
  })
  // An agent's models come from the agent, so any ID the person types may be one it knows.
  const supportsCustomModel = computed(
    () => isACP.value || Boolean(providerDef.value.supportsCustomModel)
  )
  /** A picker entry that is no catalog model. */
  const pickerEntry = (value: string, label: string, group?: string) => ({
    value,
    label,
    description: '',
    meta: undefined,
    group
  })
  const customModelOption = computed(() =>
    pickerEntry(CUSTOM_MODEL_VALUE, ai.value.customModel, ai.value.customModelGroup)
  )
  const modelOptions = computed(() => {
    const options = modelPickerOptions(availableModels.value, providerDef.value.models, ai.value)
    if (isACP.value) {
      // The agent's own choice and a custom ID come first, ahead of a long list that the picker
      // shows only the start of; a saved model the agent no longer lists stays selectable.
      const saved = draft.modelID && !options.some((option) => option.value === draft.modelID)
      return [
        pickerEntry(AGENT_DEFAULT_VALUE, ai.value.agentDefaultModel),
        customModelOption.value,
        ...(saved ? [pickerEntry(draft.modelID, draft.modelID, ai.value.allModels)] : []),
        ...options
      ]
    }
    if (!providerDef.value.supportsCustomModel) return options
    // Keep the custom entry after the curated picks and ahead of the long tail, so it stays
    // reachable in the picker's capped result list.
    const group = ai.value.recommendedModels
    const insertAt = options.findIndex((option) => option.group !== group)
    if (insertAt === -1) return [...options, customModelOption.value]
    return [...options.slice(0, insertAt), customModelOption.value, ...options.slice(insertAt)]
  })
  const selectedModelValue = computed(() => {
    if (customModelSelected.value) return CUSTOM_MODEL_VALUE
    return isACP.value && !draft.modelID ? AGENT_DEFAULT_VALUE : draft.modelID
  })
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
  const visionSwitch = capabilityModel('vision')
  // Image input starts as the agent reports it, until the person sets it themselves.
  let followImageInput = false
  const visionEnabled = computed({
    get: () => visionSwitch.value,
    set: (enabled: boolean) => {
      // An agent that reported no image input would fail every image sent to it, so Vision cannot
      // be turned on; until it has reported, the choice stays open.
      if (enabled && agent.imageInput.value === false) return
      followImageInput = false
      visionSwitch.value = enabled
    }
  })
  watch(agent.imageInput, (reported) => {
    if (followImageInput && reported !== null) {
      draft.capabilities = reported ? ['tools', 'vision'] : ['tools']
    }
  })

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
    // Shown at once, written into the profile on save: a read that finishes after the editor
    // opens is not an edit.
    catalogModel.value = resolved
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
    if (providerID !== OPENPENCIL_AI_PROVIDER) draft.cloudWorkspaceId = undefined
    if (isACP.value || isHarness.value) {
      draft.capabilities = ['tools']
      followImageInput = isACP.value
      if (isACP.value && !draft.name.trim()) draft.name = providerDisplayName.value
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
    draft.modelID = modelID === AGENT_DEFAULT_VALUE ? '' : modelID
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
    isCloud: cloud.isCloud,
    cloudWorkspaces: cloud.workspaces,
    cloudState: cloud.state,
    retryCloud: cloud.retry,
    agentModelState: agent.state,
    retryAgentModels: agent.retry,
    customModelSelected,
    supportsCustomModel,
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
    applyKnownModelMetadata,
    updateProvider,
    updateModel
  }
}
