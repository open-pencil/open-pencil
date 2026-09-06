<script setup lang="ts">
import { ref } from 'vue'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { useI18n } from '@open-pencil/vue'
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import ProviderSelect from '@/components/settings/provider-select/ProviderSelect.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import { useModelProfileEditor } from '@/app/ai/models/settings/profile-editor/use'
import type { AIProviderID } from '@open-pencil/core/constants'
const { profileId } = defineProps<{ profileId?: string }>()
const emit = defineEmits<{ done: []; deleted: [] }>()
const { ai, common, credentials } = useI18n()
const keyInput = ref('')
const deleteOpen = ref(false)
const profile = useModelProfileEditor({ profileId, keyInput, labels: ai })
const {
  draft,
  providerDef,
  isACP,
  isHarness,
  supportsReasoningEffort,
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
  clearKey,
  testConnection
} = profile
const CUSTOM_MODEL_VALUE = '__custom__'
const advancedOpen = ref(Boolean(draft.customModelID.trim()))
function updateProvider(id: AIProviderID) {
  profile.updateProvider(id)
  advancedOpen.value = id === 'harness:pi'
}
function updateModel(id: string) {
  profile.updateModel(id)
  if (id === CUSTOM_MODEL_VALUE) advancedOpen.value = true
}
async function save() {
  if (await profile.save()) emit('done')
}
async function remove() {
  if (await profile.remove()) {
    deleteOpen.value = false
    emit('deleted')
  }
}
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
          <AppCombobox
            :model-value="selectedModelValue"
            :options="modelOptions"
            :label="ai.modelID"
            :placeholder="ai.selectModel"
            :search-placeholder="ai.searchModels"
            :empty-label="common.noResults"
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
