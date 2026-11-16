import { computed, ref, watch, type Ref } from 'vue'

import {
  acpAgentFor,
  AI_PROVIDERS,
  type AIProviderID,
  type ModelOption,
  providerKind
} from '@open-pencil/core/constants'

import { AGENT_CHOICE_CATEGORIES, type AgentChoiceCategory } from '@/app/ai/agents/acp/options'
import type { AIModelProfileDraft, AIModelCapability } from '@/app/ai/models'
import { resolveModelsDevModel } from '@/app/ai/models/catalog'
import { useProviderModelCatalog } from '@/app/ai/models/catalog/use'
import { profileModelID } from '@/app/ai/models/language-model'
import { modelPickerOptions, type ModelPickerLabels } from '@/app/ai/models/picker/options'
import { supportsThinkingLevel } from '@/app/ai/models/thinking'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'

import { HOST_AGENT_MODELS, useAgentModelSelection, type AgentModelSource } from './agent'
import { useCloudModelSelection } from './cloud'

/** The texts the profile's model and option selects show. */
export type ProfileSelectionLabels = ModelPickerLabels & {
  customModel: string
  agentDefaultModel: string
  thinkingLevel: string
}

/** A select for one of an agent's options, such as its effort or mode. */
export interface AgentOptionControl {
  category: AgentChoiceCategory
  /** What the agent calls the option; the effort is the app's thinking level. */
  label: string
  options: { value: string; label: string }[]
}

export function useProfileModelSelection(
  draft: AIModelProfileDraft,
  ai: Readonly<Ref<ProfileSelectionLabels>>,
  agents: AgentModelSource = HOST_AGENT_MODELS
) {
  const CUSTOM_MODEL_VALUE = '__custom__'
  /** An agent profile that names no model, which leaves the choice to the agent. */
  const AGENT_DEFAULT_VALUE = '__agent__'
  const DEFAULT_MAX_OUTPUT_TOKENS = 16384
  const customModelSelected = ref(
    Boolean(draft.customModelID.trim()) || providerKind(draft.providerID) === 'harness'
  )
  const catalogModel = ref<ModelOption | null>(null)

  const providerDef = computed(
    () => AI_PROVIDERS.find((provider) => provider.id === draft.providerID) ?? AI_PROVIDERS[0]
  )
  const catalogProviderID = computed(() => draft.providerID)
  const fallbackModels = computed(() => providerDef.value.models)
  const { models: providerModels } = useProviderModelCatalog(catalogProviderID, fallbackModels)
  const cloud = useCloudModelSelection(draft, (modelID) => updateModel(modelID))
  const isACP = computed(() => providerKind(draft.providerID) === 'acp')
  const agent = useAgentModelSelection(draft, agents)
  const availableModels = computed(() => {
    if (cloud.isCloud.value) return cloud.models.value
    return isACP.value ? agent.models.value : providerModels.value
  })
  const isHarness = computed(() => providerKind(draft.providerID) === 'harness')
  const supportsThinking = computed(() => supportsThinkingLevel(draft.providerID))
  /**
   * One select per option the agent offers for the draft's model, such as its effort and mode,
   * each with the agent's own pick first; none while they are not read yet. A saved value the
   * model no longer lists stays, so it can be cleared. A custom model's options are never read,
   * so it keeps the agent's.
   */
  const agentOptionControls = computed<AgentOptionControl[]>(() => {
    if (!isACP.value || customModelSelected.value) return []
    return AGENT_CHOICE_CATEGORIES.flatMap((category) => {
      const choice = agent.choices.value?.[category]
      const values = choice?.values ?? []
      const saved = draft.agentChoices[category]
      if (values.length === 0 && !saved) return []
      const stranded = saved && !values.some((value) => value.id === saved)
      return [
        {
          category,
          label: category === 'thought_level' ? ai.value.thinkingLevel : (choice?.name ?? category),
          options: [
            { value: AGENT_DEFAULT_VALUE, label: ai.value.agentDefaultModel },
            ...(stranded ? [{ value: saved, label: saved }] : []),
            ...values.map((value) => ({ value: value.id, label: value.name }))
          ]
        }
      ]
    })
  })
  /** The draft's value of an option as its select shows it, which holds no empty value. */
  function agentOptionValue(category: AgentChoiceCategory): string {
    return draft.agentChoices[category] || AGENT_DEFAULT_VALUE
  }
  function setAgentOption(category: AgentChoiceCategory, value: string): void {
    draft.agentChoices = {
      ...draft.agentChoices,
      [category]: value === AGENT_DEFAULT_VALUE ? undefined : value
    }
  }
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
    const modelId = profileModelID(draft)
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
    customModelSelected.value = providerKind(providerID) === 'harness'
    draft.customBaseURL = ''
    draft.customAPIType = 'completions'
    draft.agentChoices = {}
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
      draft.agentChoices = {}
      catalogModel.value = null

      return
    }
    draft.modelID = modelID === AGENT_DEFAULT_VALUE ? '' : modelID
    // Each model offers its own efforts, so another model starts on the agent's; modes stay.
    draft.agentChoices = { ...draft.agentChoices, thought_level: undefined }
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
    agentOptionControls,
    agentOptionValue,
    setAgentOption,
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
