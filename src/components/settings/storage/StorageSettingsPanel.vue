<script setup lang="ts">
import { useStorageSettings } from '@/app/integrations/storage/settings/use'

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import { activeStorageProviderID, storageProviderRegistry } from '@/app/integrations/storage'
import CloudSettingsPanel from '@/components/settings/cloud/CloudSettingsPanel.vue'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { toast } from '@/app/shell/ui'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const { storage, settings, credentials, common } = useI18n()
const notifications = useNotificationMessages()
const router = useRouter()
const credentialDrafts = ref<Record<string, string>>({})
const providerOptions = storageProviderRegistry
  .list()
  .map((registration) => ({ value: registration.id, label: registration.label }))
const isCloudProvider = computed(() => provider.value.id === 'openpencil-cloud')

function preferenceLabel(field: string): string {
  if (field === 'server-url') return 'Server URL'
  if (field === 'workspace-id') return 'Workspace ID'
  if (field === 'endpoint') return storage.value.endpoint
  if (field === 'bucket') return storage.value.bucket
  if (field === 'region') return storage.value.region
  return field
}

function credentialLabel(field: string): string {
  if (field === 'access-key-id') return storage.value.accessKeyID
  if (field === 'secret-access-key') return storage.value.secretAccessKey
  return field
}

async function openWorkspace(): Promise<void> {
  settingsDialogOpen.value = false
  await router.push('/storage')
}

async function testConnection(): Promise<void> {
  const result = await testStorageConnection()
  if (!result) return
  if (result.ok) toast.info(notifications.value.storageConnected)
  else toast.error(notifications.value.storageConnectionFailed({ error: result.message }))
}

const {
  testConnection: testStorageConnection,
  provider,
  preferenceDrafts,
  credentialStatuses,
  busy,
  configured,
  savePreferences,
  saveCredential,
  clearCredential
} = useStorageSettings(credentialDrafts)
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-storage-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ settings.storage }}</h3>
      <p class="mt-0.5 text-[10px] text-muted">{{ provider.description }}</p>
    </div>

    <AppSelect
      v-model="activeStorageProviderID"
      label="Storage provider"
      :options="providerOptions"
    />

    <label
      v-for="field in provider.preferenceFields.filter(
        (preference) => !(isCloudProvider && preference.id === 'workspace-id')
      )"
      :key="field.id"
      class="flex flex-col gap-1 text-[10px] text-muted"
    >
      {{ preferenceLabel(field.id) }}
      <AppInput
        v-model="preferenceDrafts[field.id]"
        :placeholder="field.placeholder"
        size="sm"
        tone="panel"
        @change="savePreferences"
      />
    </label>

    <CloudSettingsPanel v-if="isCloudProvider" />

    <div
      v-for="field in provider.credentialFields"
      :key="field.id"
      class="flex flex-col gap-1"
      :data-credential="field.id"
    >
      <label :for="`storage-${field.id}`" class="text-[10px] text-muted">
        {{ credentialLabel(field.id) }}
      </label>
      <div class="flex gap-2">
        <AppInput
          :id="`storage-${field.id}`"
          v-model="credentialDrafts[field.id]"
          type="password"
          :aria-label="credentialLabel(field.id)"
          :placeholder="
            credentialStatuses[field.id] === 'configured'
              ? credentials.savedReplace
              : field.placeholder
          "
          size="sm"
          tone="panel"
          class="min-w-0 flex-1"
          @enter="saveCredential(field.id)"
        />
        <button
          v-if="credentialDrafts[field.id]?.trim()"
          type="button"
          class="rounded bg-hover px-2 text-[10px] text-surface hover:bg-active"
          @click="saveCredential(field.id)"
        >
          {{ common.save }}
        </button>
        <button
          v-else-if="credentialStatuses[field.id] === 'configured'"
          type="button"
          class="rounded px-2 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="clearCredential(field.id)"
        >
          {{ common.clear }}
        </button>
      </div>
    </div>

    <button
      type="button"
      class="mt-1 rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      :disabled="busy"
      data-test-id="settings-storage-test"
      @click="testConnection"
    >
      {{ common.testConnection }}
    </button>

    <button
      type="button"
      class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover disabled:text-muted disabled:opacity-50"
      :disabled="!configured"
      data-test-id="settings-storage-open-workspace"
      @click="openWorkspace"
    >
      {{ storage.openWorkspace }}
    </button>
  </section>
</template>
