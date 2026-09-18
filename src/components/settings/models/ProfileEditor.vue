<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { useModelProfileFeedback } from '@/app/ai/models/settings/profile-editor/feedback'
import { useModelProfileEditor } from '@/app/ai/models/settings/profile-editor/use'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import { focusInvalidField } from '@/components/settings/layout/focus'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSelect from '@/components/settings/provider-select/ProviderSelect.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
const { profileId } = defineProps<{ profileId?: string }>()
const emit = defineEmits<{ done: []; deleted: [] }>()
const { ai, common, credentials, settings } = useI18n()
const formElement = useTemplateRef<HTMLFormElement>('formElement')
const keyInput = ref('')
const deleteOpen = ref(false)
const profile = useModelProfileEditor({ profileId, keyInput, labels: ai })
const {
  draft,
  dirty,
  busy: saving,
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
  connectionTestStatus,
  connectionTestReason,
  saveError,
  saveResult,
  clearKey,
  testConnection: runConnectionTest
} = profile
const feedback = useModelProfileFeedback(profile, keyInput, settings)
const { errors: fieldErrors } = feedback
const busy = computed(() => saving.value || connectionTestStatus.value === 'testing')
useSettingsFormGuard({ dirty, busy, cancel: () => emit('done') })
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
  if (busy.value) return
  if (!(await feedback.validate('save'))) {
    await focusInvalidField(formElement.value)
    return
  }
  if ((await profile.save()) === 'saved') emit('done')
}
async function testConnection() {
  if (busy.value) return
  if (!(await feedback.validate('test'))) {
    await focusInvalidField(formElement.value)
    return
  }
  await runConnectionTest()
}
async function remove() {
  if (await profile.remove()) {
    deleteOpen.value = false
    emit('deleted')
  }
}
</script>

<template>
  <form
    ref="formElement"
    class="flex min-h-0 min-w-0 flex-1 flex-col"
    novalidate
    :aria-busy="busy"
    @submit.prevent="save"
  >
    <SettingsPage data-test-id="settings-model-editor">
      <SettingsSection>
        <template #title>{{ profileId ? ai.editModel : ai.addModel }}</template>
        <template #description>{{ ai.modelEditorDescription }}</template>
        <fieldset :disabled="busy" class="flex min-w-0 flex-col gap-3">
          <ProviderSettingsField
            v-slot="{ control }"
            :label="ai.modelName"
            :hint="settings.modelNameHint"
            :error="fieldErrors.name"
            @blur="feedback.blur('name')"
          >
            <AppInput
              v-bind="control"
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

            <ProviderSettingsField
              v-if="modelOptions.length"
              v-slot="{ control }"
              :label="ai.modelID"
              :error="fieldErrors.modelID"
              @blur="feedback.blur('modelID')"
            >
              <AppCombobox
                v-bind="control"
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
              v-slot="{ control }"
              :label="ai.customModelID"
              :hint="settings.modelIDHint"
              :error="fieldErrors.customModelID"
              @blur="feedback.blur('customModelID')"
            >
              <ProviderSettingsInput
                v-bind="control"
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

            <ProviderSettingsField
              v-if="providerDef.supportsCustomBaseURL"
              v-slot="{ control }"
              :label="ai.baseURL"
              :hint="settings.baseURLHint"
              :error="fieldErrors.baseURL"
              @blur="feedback.blur('baseURL')"
            >
              <ProviderSettingsInput
                v-bind="control"
                v-model="draft.customBaseURL"
                :aria-label="ai.baseURL"
                placeholder="http://localhost:11434/v1"
              />
            </ProviderSettingsField>

            <ProviderSettingsField
              v-if="draft.providerID === 'openai-compatible'"
              :label="ai.apiType"
            >
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
              :hint="
                hasExistingKey ? settings.savedCredentialHint : settings.optionalCredentialHint
              "
              :error="fieldErrors.credential"
              @blur="feedback.blur('credential')"
              kind="api"
              :placeholder="hasExistingKey ? credentials.savedReplace : providerDef.keyPlaceholder"
              :key-u-r-l="providerDef.keyURL"
              :key-u-r-l-label="credentials.getAPIKey"
              @clear="clearKey"
            />

            <ProviderConnectionTestButton
              v-if="!isHarness"
              :status="connectionTestStatus"
              :reason="connectionTestReason"
              :disabled="busy"
              @test="testConnection"
            />
          </template>

          <AppCollapsible
            v-if="!isACP"
            v-model:open="advancedOpen"
            :ui="{
              root: 'rounded border border-border',
              trigger: 'px-2.5 py-2 text-[11px] text-muted hover:text-surface',
              icon: 'size-3'
            }"
          >
            <template #label>{{ ai.advancedModelSettings }}</template>
            <div class="flex flex-col gap-3 border-t border-border p-2.5">
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
                    {{
                      knownCapabilities.includes('tools') ? common.supported : common.unsupported
                    }}
                  </span>
                  <AppSwitch v-else v-model="toolsEnabled" :label="ai.modelCapabilityTools" />
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[11px] text-muted">{{ ai.modelCapabilityVision }}</span>
                  <span v-if="knownModel" class="text-[10px] text-surface">
                    {{
                      knownCapabilities.includes('vision') ? common.supported : common.unsupported
                    }}
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
          </AppCollapsible>

          <SettingsSaveFeedback :error="saveError" :result="saveResult" />
        </fieldset>
      </SettingsSection>

      <template #footer>
        <AppButton v-if="canDelete" color="error" :disabled="busy" @click="deleteOpen = true">
          {{ ai.deleteModel }}
        </AppButton>
        <AppButton class="ml-auto" :disabled="busy" @click="emit('done')">
          {{ common.cancel }}
        </AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="busy">
          {{ ai.saveModel }}
        </AppButton>
      </template>
    </SettingsPage>
  </form>

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
