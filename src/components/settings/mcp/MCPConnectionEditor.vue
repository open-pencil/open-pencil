<script setup lang="ts">
import { useTemplateRef } from 'vue'

import {
  useAutomationMessages,
  useCommonMessages,
  useCredentialMessages,
  useSettingsMessages
} from '@open-pencil/vue/i18n'

import type { MCPConnectionDraft } from '@/app/integrations/mcp'
import type { MCPConnectionFieldErrors } from '@/app/integrations/mcp/settings/form'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import type { SettingsSaveResult } from '@/app/settings/save-result'
import { focusInvalidField } from '@/components/settings/layout/focus'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const draft = defineModel<MCPConnectionDraft>('draft', { required: true })
const token = defineModel<string>('token', { required: true })
const {
  tokenStatus,
  busy,
  error,
  saveResult,
  fieldErrors = {}
} = defineProps<{
  tokenStatus: CredentialStatus
  busy: boolean
  error: string
  saveResult?: SettingsSaveResult | null
  fieldErrors?: MCPConnectionFieldErrors
}>()
defineEmits<{
  cancel: []
  save: []
  remove: []
  clear: []
  blurField: [field: 'name' | 'url' | 'credential']
}>()
const automation = useAutomationMessages()
const common = useCommonMessages()
const credentials = useCredentialMessages()
const settings = useSettingsMessages()
const formElement = useTemplateRef<HTMLFormElement>('formElement')
defineExpose({ focusInvalid: () => focusInvalidField(formElement.value) })
</script>

<template>
  <form
    ref="formElement"
    class="flex min-h-0 min-w-0 flex-1 flex-col"
    :aria-busy="busy"
    novalidate
    @submit.prevent="$emit('save')"
  >
    <SettingsPage>
      <div class="flex flex-col gap-3">
        <fieldset :disabled="busy" class="flex min-w-0 flex-col gap-3">
          <ProviderSettingsField
            v-slot="{ control }"
            :label="automation.connectionName"
            :hint="automation.connectionNameHint"
            :error="fieldErrors.name"
            @blur="$emit('blurField', 'name')"
          >
            <ProviderSettingsInput
              v-bind="control"
              v-model="draft.name"
              :aria-label="automation.connectionName"
              autocomplete="off"
            />
          </ProviderSettingsField>
          <ProviderSettingsField
            v-slot="{ control }"
            :label="automation.serverURL"
            :hint="automation.serverURLHint"
            :error="fieldErrors.url"
            @blur="$emit('blurField', 'url')"
          >
            <ProviderSettingsInput
              v-bind="control"
              v-model="draft.url"
              type="url"
              :aria-label="automation.serverURL"
              placeholder="https://example.com/mcp"
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
            />
          </ProviderSettingsField>
          <SettingsGroup>
            <SettingsRow :label="automation.enableConnection">
              <AppSwitch
                v-model="draft.enabled"
                :label="automation.enableConnection"
                :disabled="busy"
              />
            </SettingsRow>
            <SettingsRow :label="automation.bearerAuthentication">
              <AppSwitch
                :model-value="draft.authenticationType === 'bearer'"
                :label="automation.bearerAuthentication"
                :disabled="busy"
                @update:model-value="draft.authenticationType = $event ? 'bearer' : 'none'"
              />
            </SettingsRow>
          </SettingsGroup>
          <ProviderSettingsKeyField
            v-if="draft.authenticationType === 'bearer'"
            v-model="token"
            :label="automation.bearerToken"
            input-id="mcp-bearer-token"
            :saved="tokenStatus === 'configured'"
            kind="api"
            :placeholder="
              tokenStatus === 'configured'
                ? credentials.savedReplace
                : automation.bearerTokenPlaceholder
            "
            :hint="
              tokenStatus === 'configured'
                ? settings.savedCredentialHint
                : automation.bearerTokenRequired
            "
            :error="fieldErrors.credential"
            @clear="$emit('clear')"
            @blur="$emit('blurField', 'credential')"
          />
        </fieldset>
        <SettingsSaveFeedback :error="error" :result="saveResult" />
      </div>
      <template #footer>
        <AppButton
          v-if="draft.id"
          class="mr-auto"
          color="error"
          variant="link"
          :disabled="busy"
          @click="$emit('remove')"
          >{{ automation.deleteConnection }}</AppButton
        >
        <AppButton :disabled="busy" @click="$emit('cancel')">{{ common.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="busy">{{
          common.save
        }}</AppButton>
      </template>
    </SettingsPage>
  </form>
</template>
