<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'
import { useStorageSettings } from '@/app/integrations/storage/settings/use'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

const { storage, settings, credentials, common } = useI18n()
const notifications = useNotificationMessages()
const router = useRouter()
const credentialDrafts = ref<Record<string, string>>({})

function preferenceLabel(field: string): string {
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

    <label
      v-for="field in provider.preferenceFields"
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
        <AppButton
          v-if="credentialDrafts[field.id]?.trim()"
          size="xs"
          variant="soft"
          @click="saveCredential(field.id)"
        >
          {{ common.save }}
        </AppButton>
        <AppButton
          v-else-if="credentialStatuses[field.id] === 'configured'"
          size="xs"
          @click="clearCredential(field.id)"
        >
          {{ common.clear }}
        </AppButton>
      </div>
    </div>

    <div class="mt-1 flex flex-wrap items-center gap-2">
      <AppButton
        color="primary"
        variant="solid"
        :disabled="busy"
        data-test-id="settings-storage-test"
        @click="testConnection"
      >
        {{ common.testConnection }}
      </AppButton>

      <AppButton
        variant="outline"
        :disabled="!configured"
        data-test-id="settings-storage-open-workspace"
        @click="openWorkspace"
      >
        {{ storage.openWorkspace }}
      </AppButton>
    </div>
  </section>
</template>
