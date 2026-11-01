<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'

import type { AIProviderID } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import { useCodingAgentSetup, usePiSetup } from '@/app/ai/agents/setup/use'
import { useModelProfileFeedback } from '@/app/ai/models/settings/profile-editor/feedback'
import { useProfileSignIn } from '@/app/ai/models/settings/profile-editor/sign-in'
import { useModelProfileEditor } from '@/app/ai/models/settings/profile-editor/use'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import AgentSetup from '@/components/settings/agents/AgentSetup.vue'
import PiSetup from '@/components/settings/agents/PiSetup.vue'
import { focusInvalidField } from '@/components/settings/layout/focus'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProfileCapabilities from '@/components/settings/models/ProfileCapabilities.vue'
import ProviderChooser from '@/components/settings/models/ProviderChooser.vue'
import ProviderSelect from '@/components/settings/provider-select/ProviderSelect.vue'
import ChatGPTSignInField from '@/components/settings/provider/ChatGPTSignInField.vue'
import ProviderConnectionTestButton from '@/components/settings/provider/ProviderConnectionTestButton.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
const { profileId } = defineProps<{ profileId?: string }>()
const emit = defineEmits<{ done: []; deleted: [] }>()
const { ai, common, credentials, settings } = useI18n()
const formElement = useTemplateRef<HTMLFormElement>('formElement')
const nameInput = useTemplateRef('nameInput')
/** A new model starts by choosing what it runs on; the form follows for that choice. */
const choosing = ref(!profileId)
defineExpose({
  focus: () => {
    if (!choosing.value) return nameInput.value?.focus({ preventScroll: true })
    formElement.value?.querySelector<HTMLElement>('[data-provider]')?.focus({ preventScroll: true })
  }
})
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
  isCloud,
  cloudWorkspaces,
  cloudState,
  retryCloud,
  supportsThinking,
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
const pi = usePiSetup(isHarness)
const codingAgent = useCodingAgentSetup(() => draft.providerID)
const signIn = useProfileSignIn(keyInput)
const customModelPlaceholder = computed(() =>
  isHarness.value ? (pi.state.value?.defaultModel ?? 'provider/model') : 'e.g. llama-3.3-70b'
)
const feedback = useModelProfileFeedback(profile, keyInput, settings)
const { errors: fieldErrors } = feedback
const busy = computed(() => saving.value || connectionTestStatus.value === 'testing')
const cloudWorkspaceOptions = computed(() =>
  cloudWorkspaces.value.map((workspace) => ({ value: workspace.id, label: workspace.name }))
)
const cloudNotice = computed(() => {
  if (cloudState.value === 'unavailable') return ai.value.cloudAIUnavailable
  if (cloudState.value === 'workspaces-failed') return ai.value.cloudAIWorkspacesFailed
  if (cloudState.value === 'no-workspace') return ai.value.cloudAINoWorkspace
  if (cloudState.value === 'catalog-failed') return ai.value.cloudAICatalogFailed
  return null
})
useSettingsFormGuard({
  dirty,
  busy,
  cancel: () => emit('done'),
  crumb: {
    parent: () => ai.value.modelsTitle,
    title: () => (profileId ? ai.value.editModel : ai.value.addModel)
  }
})
const CUSTOM_MODEL_VALUE = '__custom__'
function updateProvider(id: AIProviderID) {
  // A sign-in still waiting must not land in another provider's key.
  signIn.cancel()
  profile.updateProvider(id)
}

async function choose(id: AIProviderID) {
  updateProvider(id)
  choosing.value = false
  await nextTick()
  nameInput.value?.focus({ preventScroll: true })
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
      <ProviderChooser v-if="choosing" @choose="choose" />
      <fieldset v-else :disabled="busy" class="flex min-w-0 flex-col gap-6">
        <ProviderSettingsField
          v-slot="{ control }"
          :label="ai.modelName"
          :hint="settings.modelNameHint"
          :error="fieldErrors.name"
          @blur="feedback.blur('name')"
        >
          <ProviderSettingsInput
            ref="nameInput"
            v-bind="control"
            v-model="draft.name"
            :aria-label="ai.modelName"
            :placeholder="modelDisplayName"
          />
        </ProviderSettingsField>

        <SettingsSection>
          <template #title>{{ ai.modelConfiguration }}</template>
          <ProviderSettingsField v-slot="{ control }" :label="ai.provider">
            <ProviderSelect
              v-bind="control"
              :model-value="draft.providerID"
              :aria-label="ai.provider"
              data-test-id="settings-model-provider"
              @update:model-value="updateProvider"
            />
          </ProviderSettingsField>
          <div
            v-if="codingAgent.agent.value && codingAgent.state.value"
            class="flex flex-col gap-2"
            data-test-id="settings-agent-setup"
          >
            <AgentSetup
              :agent="codingAgent.agent.value"
              :setup="codingAgent.state.value"
              @check="codingAgent.check()"
              @install-agent="codingAgent.install()"
              @install-bridge="codingAgent.installBridge()"
              @sign-in="codingAgent.signIn()"
              @cancel-sign-in="codingAgent.cancelSignIn()"
              @submit-sign-in-code="codingAgent.submitSignInCode($event)"
            />
          </div>

          <div v-if="pi.state.value" class="flex flex-col gap-2" data-test-id="settings-pi-setup">
            <PiSetup
              :setup="pi.state.value"
              @check="pi.refresh()"
              @install-companion="pi.installCompanion()"
              @install-bridge="pi.installBridge()"
            />
          </div>

          <div
            v-if="isCloud && cloudNotice"
            class="flex items-start justify-between gap-2"
            data-test-id="settings-cloud-ai-notice"
          >
            <p class="text-xs leading-relaxed text-muted">{{ cloudNotice }}</p>
            <AppButton
              v-if="cloudState === 'catalog-failed' || cloudState === 'workspaces-failed'"
              variant="outline"
              size="sm"
              @click="retryCloud"
            >
              {{ ai.retryRequest }}
            </AppButton>
          </div>

          <ProviderSettingsField
            v-if="isCloud && cloudWorkspaceOptions.length"
            :label="ai.cloudWorkspace"
            :hint="ai.cloudWorkspaceHint"
            v-slot="{ control }"
            :error="fieldErrors.cloudWorkspace"
          >
            <AppSelect
              v-bind="control"
              :model-value="draft.cloudWorkspaceId ?? ''"
              :label="ai.cloudWorkspace"
              :options="cloudWorkspaceOptions"
              data-test-id="settings-cloud-ai-workspace"
              @update:model-value="draft.cloudWorkspaceId = String($event)"
            />
          </ProviderSettingsField>

          <template v-if="!isACP">
            <ProviderSettingsField
              v-if="modelOptions.length && !isHarness"
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
                @update:model-value="profile.updateModel(String($event))"
              />
            </ProviderSettingsField>

            <ProviderSettingsField
              v-if="providerDef.supportsCustomModel && selectedModelValue === CUSTOM_MODEL_VALUE"
              v-slot="{ control }"
              :label="ai.customModelID"
              :hint="isHarness ? ai.piModelHint : settings.modelIDHint"
              :error="fieldErrors.customModelID"
              @blur="feedback.blur('customModelID')"
            >
              <ProviderSettingsInput
                v-bind="control"
                v-model="draft.customModelID"
                :aria-label="ai.customModelID"
                data-test-id="provider-settings-custom-model"
                :placeholder="customModelPlaceholder"
              />
            </ProviderSettingsField>
          </template>
        </SettingsSection>

        <template v-if="!isACP">
          <SettingsSection>
            <template #title>{{ ai.connectionSettings }}</template>

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
              v-slot="{ control }"
              :label="ai.apiType"
            >
              <AppSelect
                v-bind="control"
                v-model="draft.customAPIType"
                :label="ai.apiType"
                :options="[
                  { value: 'completions', label: ai.completions },
                  { value: 'responses', label: ai.responses }
                ]"
              />
            </ProviderSettingsField>

            <ChatGPTSignInField
              v-if="providerDef.signInOnly"
              :saved="hasExistingKey"
              :signed-in="signIn.signedIn.value"
              :email="signIn.email.value"
              :status="signIn.status.value"
              :disabled="busy"
              @sign-in="signIn.signIn()"
              @reopen="signIn.reopen()"
              @cancel="signIn.cancel()"
              @sign-out="clearKey"
            />
            <ProviderSettingsKeyField
              v-else-if="!isCloud"
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
          </SettingsSection>

          <ProfileCapabilities
            v-model:tools="toolsEnabled"
            v-model:vision="visionEnabled"
            v-model:thinking-level="draft.thinkingLevel"
            v-model:permission-mode="draft.harnessPermissionMode"
            :detected="knownModel !== null"
            :capabilities="knownCapabilities"
            :output-tokens="outputTokenRecommendation"
            :thinking="supportsThinking"
            :harness="isHarness"
          />
        </template>

        <SettingsSaveFeedback :error="saveError" :result="saveResult" />
      </fieldset>

      <template #footer>
        <AppButton v-if="canDelete" color="error" :disabled="busy" @click="deleteOpen = true">
          {{ ai.deleteModel }}
        </AppButton>
        <AppButton class="ml-auto" :disabled="busy" @click="emit('done')">
          {{ common.cancel }}
        </AppButton>
        <AppButton v-if="!choosing" type="submit" color="primary" variant="solid" :loading="busy">
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
