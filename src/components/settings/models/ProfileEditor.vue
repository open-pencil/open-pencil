<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { useI18n } from '@open-pencil/vue'

import { ACP_AGENTS, AI_PROVIDERS, type AIProviderID } from '@open-pencil/core/constants'

import { refreshAIProviderStatus } from '@/app/ai/chat/storage'
import { resolveModelsDevModel } from '@/app/ai/models/catalog'
import {
  testProviderConnection,
  type ProviderConnectionTestFailureReason
} from '@/app/ai/chat/connection-test'
import {
  aiModelSettings,
  createModelProfileDraft,
  findModelConnectionForDraft,
  modelConnectionCredentialStatus,
  modelConnectionUsageCount,
  modelProfile,
  removeModelProfile,
  resolveModelConnectionAPIKey,
  saveModelProfileDraft,
  setModelConnectionAPIKey,
  type AIModelCapability
} from '@/app/ai/models'
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import ProviderSelect from '@/components/settings/provider-select/ProviderSelect.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'

const CUSTOM_MODEL_VALUE = '__custom__'
const DEFAULT_MAX_OUTPUT_TOKENS = 16_384

const { profileId } = defineProps<{ profileId?: string }>()
const emit = defineEmits<{ done: []; deleted: [] }>()
const { ai, common, credentials } = useI18n()
const draft = reactive(createModelProfileDraft(profileId))
const keyInput = ref('')
const keyStatus = ref<'configured' | 'missing' | 'unavailable' | 'locked'>('missing')
const saveError = ref<string | null>(null)
const connectionTestStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const connectionTestReason = ref<ProviderConnectionTestFailureReason | null>(null)
const deleteOpen = ref(false)
const advancedOpen = ref(Boolean(draft.customModelID.trim()))
const customModelSelected = ref(
  Boolean(draft.customModelID.trim()) || draft.providerID === 'harness:pi'
)
const catalogModel = ref<(typeof providerDef.value.models)[number] | null>(null)

const providerDef = computed(
  () => AI_PROVIDERS.find((provider) => provider.id === draft.providerID) ?? AI_PROVIDERS[0]
)
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
const modelOptions = computed(() => [
  ...providerDef.value.models.map((model) => ({ value: model.id, label: model.name })),
  ...(providerDef.value.supportsCustomModel
    ? [{ value: CUSTOM_MODEL_VALUE, label: ai.value.customModel }]
    : [])
])
const selectedModelValue = computed(() =>
  customModelSelected.value ? CUSTOM_MODEL_VALUE : draft.modelID
)
const knownModel = computed(() => {
  if (isACP.value) return null
  if (draft.customModelID.trim()) return catalogModel.value
  return (
    catalogModel.value ??
    providerDef.value.models.find((model) => model.id === draft.modelID) ??
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
  return providerDef.value.models.find((model) => model.id === modelId)?.name || modelId
})
const hasExistingKey = computed(() => keyStatus.value === 'configured')
const canDelete = computed(() => Boolean(profileId) && aiModelSettings.value.models.length > 1)
const toolsEnabled = capabilityModel('tools')
const visionEnabled = capabilityModel('vision')
const canSave = computed(
  () =>
    Boolean(draft.name.trim()) &&
    (isACP.value ||
      (customModelSelected.value
        ? Boolean(draft.customModelID.trim())
        : Boolean(draft.modelID.trim())))
)
const canTest = computed(() => {
  if (isACP.value || isHarness.value) return false
  if (!keyInput.value.trim() && !hasExistingKey.value) return false
  if (providerDef.value.supportsCustomBaseURL && !draft.customBaseURL.trim()) return false
  return customModelSelected.value
    ? Boolean(draft.customModelID.trim())
    : Boolean(draft.modelID.trim())
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

function resetConnectionTest(): void {
  connectionTestStatus.value = 'idle'
  connectionTestReason.value = null
}

async function refreshKeyStatus(): Promise<void> {
  const connection = findModelConnectionForDraft(draft)
  keyStatus.value = connection ? await modelConnectionCredentialStatus(connection.id) : 'missing'
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
  catalogModel.value = await resolveModelsDevModel(providerID, modelID)
  if (providerID !== draft.providerID || modelID !== effectiveModelID()) return
  applyKnownModelMetadata()
}

function applyKnownModelMetadata(): void {
  if (!knownModel.value) return
  draft.capabilities = [...knownCapabilities.value]
  draft.maxOutputTokens = outputTokenRecommendation.value
}

function updateProvider(providerID: AIProviderID): void {
  draft.providerID = providerID
  draft.sourceConnectionId = null
  const provider = AI_PROVIDERS.find((definition) => definition.id === providerID)
  draft.modelID = provider?.defaultModel ?? ''
  draft.customModelID = ''
  customModelSelected.value = providerID === 'harness:pi'
  draft.customBaseURL = ''
  draft.customAPIType = 'completions'
  advancedOpen.value = providerID === 'harness:pi'
  if (providerID.startsWith('acp:')) {
    draft.capabilities = ['tools']
    if (!draft.name.trim()) draft.name = providerDisplayName.value
  } else {
    applyKnownModelMetadata()
  }
  keyInput.value = ''
  resetConnectionTest()
  void refreshCatalogModel()
  void refreshKeyStatus()
}

function updateModel(modelID: string): void {
  if (modelID === CUSTOM_MODEL_VALUE) {
    customModelSelected.value = true
    draft.customModelID = ''
    advancedOpen.value = true
    catalogModel.value = null
    resetConnectionTest()
    return
  }
  draft.modelID = modelID
  customModelSelected.value = false
  draft.customModelID = ''
  applyKnownModelMetadata()
  void refreshCatalogModel()
  if (!draft.name.trim()) draft.name = modelDisplayName.value
  resetConnectionTest()
}

async function save(): Promise<void> {
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
    emit('done')
  } catch (reason) {
    saveError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

async function clearKey(): Promise<void> {
  const connection = findModelConnectionForDraft(draft)
  if (!connection) return
  await setModelConnectionAPIKey(connection.id, '')
  await refreshAIProviderStatus()
  keyInput.value = ''
  await refreshKeyStatus()
}

async function testConnection(): Promise<void> {
  connectionTestStatus.value = 'testing'
  connectionTestReason.value = null
  const connection = findModelConnectionForDraft(draft)
  const existingKey = connection ? await resolveModelConnectionAPIKey(connection.id) : null
  const result = await testProviderConnection({
    providerID: draft.providerID,
    apiKey: keyInput.value.trim() || existingKey || '',
    modelID: draft.modelID,
    customModelID: draft.customModelID,
    customBaseURL: draft.customBaseURL,
    customAPIType: draft.customAPIType
  })
  if (result.ok) {
    connectionTestStatus.value = 'success'
    return
  }
  connectionTestStatus.value = 'error'
  connectionTestReason.value = result.reason
}

async function remove(): Promise<void> {
  if (!profileId) return
  const profile = modelProfile(profileId)
  if (profile && modelConnectionUsageCount(profile.connectionId) === 1) {
    await setModelConnectionAPIKey(profile.connectionId, '')
  }
  removeModelProfile(profileId)
  await refreshAIProviderStatus()
  deleteOpen.value = false
  emit('deleted')
}

watch(
  () => [draft.customBaseURL, draft.customModelID, draft.customAPIType, draft.modelID],
  resetConnectionTest
)
watch(
  () => draft.customModelID,
  () => {
    if (customModelSelected.value) void refreshCatalogModel()
  }
)
void refreshCatalogModel()
void refreshKeyStatus()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col" data-test-id="settings-model-editor">
    <div class="flex items-center gap-2 border-b border-border pb-3">
      <button
        type="button"
        class="flex size-6 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
        :aria-label="common.back"
        @click="emit('done')"
      >
        <icon-lucide-arrow-left class="size-3.5" />
      </button>
      <div>
        <h3 class="text-xs font-semibold text-surface">
          {{ profileId ? ai.editModel : ai.addModel }}
        </h3>
        <p class="text-[10px] text-muted">{{ ai.modelEditorDescription }}</p>
      </div>
    </div>

    <div class="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto py-3 pr-1">
      <ProviderSettingsField :label="ai.modelName">
        <AppInput
          v-model="draft.name"
          :aria-label="ai.modelName"
          :placeholder="modelDisplayName"
          size="sm"
        />
      </ProviderSettingsField>

      <ProviderSettingsField :label="ai.provider">
        <ProviderSelect
          :model-value="draft.providerID"
          :aria-label="ai.provider"
          data-test-id="settings-model-provider"
          :ui="{
            trigger:
              'w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface',
            item: 'rounded px-2 py-1.5 text-[11px]'
          }"
          @update:model-value="updateProvider"
        />
      </ProviderSettingsField>

      <template v-if="!isACP">
        <div class="flex items-center gap-2 pt-1">
          <p class="text-[10px] font-medium uppercase tracking-wide text-muted">
            {{ ai.modelConfiguration }}
          </p>
          <div class="h-px flex-1 bg-border" />
        </div>

        <ProviderSettingsField v-if="modelOptions.length" :label="ai.modelID">
          <AppSelect
            :model-value="selectedModelValue"
            :options="modelOptions"
            :label="ai.modelID"
            @update:model-value="updateModel(String($event))"
          />
        </ProviderSettingsField>

        <ProviderSettingsField
          v-if="providerDef.supportsCustomModel && selectedModelValue === CUSTOM_MODEL_VALUE"
          :label="ai.customModelID"
        >
          <ProviderSettingsInput
            v-model="draft.customModelID"
            :aria-label="ai.customModelID"
            data-test-id="provider-settings-custom-model"
            placeholder="e.g. llama-3.3-70b"
          />
        </ProviderSettingsField>

        <div class="flex items-center gap-2 pt-1">
          <p class="text-[10px] font-medium uppercase tracking-wide text-muted">
            {{ ai.connectionSettings }}
          </p>
          <div class="h-px flex-1 bg-border" />
        </div>

        <ProviderSettingsField v-if="providerDef.supportsCustomBaseURL" :label="ai.baseURL">
          <ProviderSettingsInput
            v-model="draft.customBaseURL"
            :aria-label="ai.baseURL"
            placeholder="http://localhost:11434/v1"
          />
        </ProviderSettingsField>

        <ProviderSettingsField v-if="draft.providerID === 'openai-compatible'" :label="ai.apiType">
          <AppSelect
            v-model="draft.customAPIType"
            :label="ai.apiType"
            :options="[
              { value: 'completions', label: ai.completions },
              { value: 'responses', label: ai.responses }
            ]"
          />
        </ProviderSettingsField>

        <ProviderSettingsKeyField
          v-model="keyInput"
          :label="ai.apiKey"
          :saved="hasExistingKey"
          kind="api"
          :placeholder="hasExistingKey ? credentials.savedReplace : providerDef.keyPlaceholder"
          :key-u-r-l="providerDef.keyURL"
          :key-u-r-l-label="credentials.getAPIKey"
          @clear="clearKey"
        />

        <ProviderConnectionTestButton
          :status="connectionTestStatus"
          :reason="connectionTestReason"
          :disabled="!canTest"
          @test="testConnection"
        />
      </template>

      <CollapsibleRoot
        v-if="!isACP"
        v-model:open="advancedOpen"
        class="rounded border border-border"
      >
        <CollapsibleTrigger
          class="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] text-muted hover:text-surface"
        >
          <icon-lucide-chevron-right
            class="size-3 transition-transform [[data-state=open]>&]:rotate-90"
          />
          {{ ai.advancedModelSettings }}
        </CollapsibleTrigger>
        <CollapsibleContent class="border-t border-border p-2.5">
          <div class="flex flex-col gap-3">
            <div>
              <p class="text-[11px] font-medium text-surface">{{ ai.modelCapabilities }}</p>
              <p class="mt-0.5 text-[10px] text-muted">
                {{ knownModel ? ai.modelCapabilitiesDetected : ai.modelCapabilitiesManual }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[11px] text-muted">{{ ai.modelCapabilityTools }}</span>
                <span v-if="knownModel" class="text-[10px] text-surface">
                  {{ knownCapabilities.includes('tools') ? common.supported : common.unsupported }}
                </span>
                <AppSwitch v-else v-model="toolsEnabled" :label="ai.modelCapabilityTools" />
              </div>
              <div class="flex items-center justify-between gap-3">
                <span class="text-[11px] text-muted">{{ ai.modelCapabilityVision }}</span>
                <span v-if="knownModel" class="text-[10px] text-surface">
                  {{ knownCapabilities.includes('vision') ? common.supported : common.unsupported }}
                </span>
                <AppSwitch v-else v-model="visionEnabled" :label="ai.modelCapabilityVision" />
              </div>
            </div>

            <ProviderSettingsField v-if="isHarness" :label="ai.harnessThinkingLevel">
              <AppSelect
                v-model="draft.harnessThinkingLevel"
                :label="ai.harnessThinkingLevel"
                :options="[
                  { value: 'off', label: ai.harnessThinkingOff },
                  { value: 'minimal', label: ai.harnessThinkingMinimal },
                  { value: 'low', label: ai.harnessThinkingLow },
                  { value: 'medium', label: ai.harnessThinkingMedium },
                  { value: 'high', label: ai.harnessThinkingHigh },
                  { value: 'xhigh', label: ai.harnessThinkingExtraHigh }
                ]"
              />
            </ProviderSettingsField>

            <ProviderSettingsField v-if="isHarness" :label="ai.harnessToolPermissions">
              <AppSelect
                v-model="draft.harnessPermissionMode"
                :label="ai.harnessToolPermissions"
                :options="[
                  { value: 'allow-reads', label: ai.harnessPermissionReads },
                  { value: 'allow-edits', label: ai.harnessPermissionEdits },
                  { value: 'allow-all', label: ai.harnessPermissionAll }
                ]"
              />
            </ProviderSettingsField>

            <ProviderSettingsField v-if="supportsReasoningEffort" :label="ai.reasoningEffort">
              <ProviderSettingsInput
                v-model="draft.reasoningEffort"
                :aria-label="ai.reasoningEffort"
                :placeholder="ai.reasoningEffortPlaceholder"
              />
              <p class="mt-1 text-[10px] text-muted">{{ ai.reasoningEffortDescription }}</p>
            </ProviderSettingsField>

            <div class="border-t border-border pt-2.5">
              <p class="text-[11px] font-medium text-surface">{{ ai.outputLimit }}</p>
              <p class="mt-0.5 text-[10px] text-muted">
                {{ ai.outputLimitAutomatic }} ·
                {{ outputTokenRecommendation.toLocaleString() }}
                {{ common.tokens }}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </CollapsibleRoot>

      <p v-if="saveError" class="text-[10px] text-danger" role="alert">{{ saveError }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-2 border-t border-border pt-3">
      <button
        v-if="canDelete"
        type="button"
        class="rounded px-2.5 py-1.5 text-[11px] text-danger hover:bg-danger/10"
        @click="deleteOpen = true"
      >
        {{ ai.deleteModel }}
      </button>
      <button
        type="button"
        class="ml-auto rounded px-2.5 py-1.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
        @click="emit('done')"
      >
        {{ common.cancel }}
      </button>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        :disabled="!canSave"
        @click="save"
      >
        {{ ai.saveModel }}
      </button>
    </div>
  </div>

  <AppConfirmationDialog
    v-model:open="deleteOpen"
    data-test-id="delete-model-dialog"
    :heading="ai.deleteModel"
    :description="ai.deleteModelDescription"
    :cancel-label="common.cancel"
    :confirm-label="ai.deleteModel"
    tone="danger"
    @confirm="remove"
  />
</template>
