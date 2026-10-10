<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import {
  useCommonMessages,
  useCredentialMessages,
  useSettingsMessages,
  useStorageMessages
} from '@open-pencil/vue'

import { homeLocation } from '@/app/home/location'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { useStorageSettingsFeedback } from '@/app/integrations/storage/settings/feedback'
import { useStorageSettings } from '@/app/integrations/storage/settings/use'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import { focusInvalidField } from '@/components/settings/layout/focus'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSaveFeedback from '@/components/settings/layout/SettingsSaveFeedback.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'

const storage = useStorageMessages()
const settings = useSettingsMessages()
const credentials = useCredentialMessages()
const common = useCommonMessages()
const notifications = useNotificationMessages()
const router = useRouter()
const editing = ref(false)
const credentialDrafts = ref<Record<string, string>>({})
const connection = useStorageSettings(credentialDrafts)
const feedback = useStorageSettingsFeedback(connection, credentialDrafts, settings)
const { errors: fieldErrors } = feedback
const formElement = useTemplateRef<HTMLFormElement>('formElement')
const testResult = ref<'success' | 'error' | null>(null)
const testing = computed(() => connection.operation.value === 'test')
const {
  provider,
  preferenceDrafts,
  credentialStatuses,
  busy,
  configured,
  dirty,
  error,
  saveResult,
  clearCredential
} = connection
useSettingsFormGuard({ dirty, busy, cancel }, editing)

function preferenceLabel(field: string) {
  if (field === 'endpoint') return storage.value.endpoint
  if (field === 'bucket') return storage.value.bucket
  if (field === 'region') return storage.value.region
  return field
}
function credentialLabel(field: string) {
  if (field === 'access-key-id') return storage.value.accessKeyID
  if (field === 'secret-access-key') return storage.value.secretAccessKey
  return field
}
function edit() {
  connection.begin()
  feedback.reset()
  testResult.value = null
  editing.value = true
}
function cancel() {
  connection.cancel()
  editing.value = false
}
async function save() {
  if (busy.value) return
  if (!(await feedback.validate('save'))) {
    await focusInvalidField(formElement.value)
    return
  }
  if ((await connection.save()) === 'saved') editing.value = false
}
async function openWorkspace() {
  settingsDialogOpen.value = false
  homeLocation.value = { kind: 'storage' }
  await router.push('/storage')
}
async function testConnection() {
  if (busy.value) return
  testResult.value = null
  if (!(await feedback.validate('test'))) {
    await focusInvalidField(formElement.value)
    return
  }
  const result = await connection.testConnection()
  if (result) testResult.value = result.ok ? 'success' : 'error'
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
    <SettingsPage data-test-id="settings-storage-panel">
      <SettingsSection v-if="!editing">
        <template #title>{{ settings.storage }}</template>
        <template #description>{{ provider.description }}</template>
        <AppActionRow @click="edit">
          {{ provider.label }}
          <template #description>{{
            configured ? settings.configured : settings.notConfigured
          }}</template>
          <template #trailing
            >{{ settings.edit }}<icon-lucide-chevron-right class="size-3.5"
          /></template>
        </AppActionRow>
        <AppButton
          class="self-start"
          variant="outline"
          :disabled="!configured"
          data-test-id="settings-storage-open-workspace"
          @click="openWorkspace"
          >{{ storage.openWorkspace }}</AppButton
        >
        <p v-if="!configured" class="text-[11px] text-muted">{{ settings.configureStorageHint }}</p>
      </SettingsSection>
      <SettingsSection v-else>
        <template #title>{{ settings.storage }}</template>
        <template #description>{{ settings.saveChangesDescription }}</template>
        <fieldset :disabled="busy" class="flex min-w-0 flex-col gap-4">
          <ProviderSettingsField
            v-for="field in provider.preferenceFields"
            :key="field.id"
            v-slot="{ control }"
            :label="preferenceLabel(field.id)"
            :hint="field.kind === 'url' ? settings.baseURLHint : field.placeholder"
            :error="fieldErrors[field.id]"
            @blur="feedback.blur(field.id)"
          >
            <AppInput
              v-bind="control"
              :model-value="preferenceDrafts[field.id] ?? ''"
              @update:model-value="preferenceDrafts[field.id] = String($event)"
              :type="field.kind"
              :placeholder="field.placeholder"
              :aria-label="preferenceLabel(field.id)"
              tone="panel"
            />
          </ProviderSettingsField>
          <ProviderSettingsField
            v-for="field in provider.credentialFields"
            :key="field.id"
            v-slot="{ control }"
            :label="credentialLabel(field.id)"
            :label-for="`storage-${field.id}`"
            :hint="
              credentialStatuses[field.id] === 'configured'
                ? settings.savedCredentialHint
                : field.placeholder
            "
            :error="fieldErrors[`credential:${field.id}`]"
            :clear-label="credentialStatuses[field.id] === 'configured' ? common.clear : undefined"
            @clear="clearCredential(field.id)"
            @blur="feedback.blur(`credential:${field.id}`)"
          >
            <AppInput
              v-bind="control"
              :model-value="credentialDrafts[field.id] ?? ''"
              @update:model-value="credentialDrafts[field.id] = String($event)"
              type="password"
              :aria-label="credentialLabel(field.id)"
              :placeholder="
                credentialStatuses[field.id] === 'configured'
                  ? credentials.savedReplace
                  : field.placeholder
              "
              tone="panel"
              autocomplete="new-password"
            />
          </ProviderSettingsField>
        </fieldset>
        <AppButton
          class="self-start"
          variant="outline"
          :loading="testing"
          :disabled="busy"
          data-test-id="settings-storage-test"
          @click="testConnection"
        >
          <template #leading><icon-lucide-plug-zap aria-hidden="true" /></template>
          {{ testing ? common.testingConnection : common.testConnection }}
        </AppButton>
        <AppAlert
          v-if="testResult"
          :tone="testResult === 'success' ? 'success' : 'error'"
          :heading="
            testResult === 'success' ? notifications.storageConnected : settings.connectionFailed
          "
        />
        <SettingsSaveFeedback :error="error" :result="saveResult" />
      </SettingsSection>
      <template v-if="editing" #footer>
        <AppButton :disabled="busy" @click="cancel">{{ common.cancel }}</AppButton>
        <AppButton
          type="submit"
          color="primary"
          variant="solid"
          :loading="busy && !testing"
          :disabled="busy"
          >{{ common.save }}</AppButton
        >
      </template>
    </SettingsPage>
  </form>
</template>
