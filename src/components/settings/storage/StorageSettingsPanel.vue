<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { useI18n } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  readStoragePreferences,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  writeStoragePreference,
  type StorageConnectionResult,
  type StorageCredentialField,
  type StoragePreferenceField,
  type StorageProviderID
} from '@/app/integrations/storage'
import {
  buildCorsConfigurationJson,
  collectCloudCorsOrigins
} from '@/app/integrations/storage/s3/cors'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { resumeStorageSync } from '@/app/storage/sync'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { dialogs } = useI18n()
const router = useRouter()
const { copy, copied } = useClipboard()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const providerOptions = computed(() =>
  storageProviderRegistry.list().map((registration) => ({
    value: registration.id,
    label: registration.label
  }))
)

function initialPreferenceDrafts(providerID: StorageProviderID): Record<string, string> {
  const stored = readStoragePreferences(providerID)
  return Object.fromEntries(
    storageProviderRegistry
      .get(providerID)
      .preferenceFields.map((field) => [field.id, stored[field.id] ?? ''])
  )
}

function emptyCredentialDrafts(providerID: StorageProviderID): Record<string, string> {
  return Object.fromEntries(
    storageProviderRegistry.get(providerID).credentialFields.map((field) => [field.id, ''])
  )
}

const preferenceDrafts = ref(initialPreferenceDrafts(provider.value.id))
const credentialDrafts = ref(emptyCredentialDrafts(provider.value.id))
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const busy = ref(false)
const result = ref<StorageConnectionResult | null>(null)
const configured = computed(
  () =>
    storagePreferencesComplete(provider.value.id) &&
    provider.value.credentialFields.every(
      (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
    )
)

function preferenceLabel(field: StoragePreferenceField): string {
  if (field.id === 'endpoint') return dialogs.value.storageEndpoint
  if (field.id === 'bucket') return dialogs.value.storageBucket
  if (field.id === 'region') return dialogs.value.storageRegion
  return field.label
}

function credentialLabel(field: StorageCredentialField): string {
  if (field.id === 'access-key-id') return dialogs.value.storageAccessKeyID
  if (field.id === 'secret-access-key') return dialogs.value.storageSecretAccessKey
  return field.label
}

async function refreshStatuses(): Promise<void> {
  credentialStatuses.value = await storageCredentialStatuses(provider.value.id)
}

function savePreferences(): void {
  for (const field of provider.value.preferenceFields) {
    writeStoragePreference(provider.value.id, field.id, preferenceDrafts.value[field.id] ?? '')
  }
  void resumeStorageSync()
}

async function saveCredential(field: string): Promise<void> {
  const value = credentialDrafts.value[field]?.trim()
  if (!value) return
  await appCredentialServices.manager.set(credentialRef(provider.value.id, field), value)
  credentialDrafts.value[field] = ''
  await refreshStatuses()
  await resumeStorageSync()
}

async function clearCredential(field: string): Promise<void> {
  await appCredentialServices.manager.clear(credentialRef(provider.value.id, field))
  credentialDrafts.value[field] = ''
  await refreshStatuses()
}

async function openWorkspace(): Promise<void> {
  settingsDialogOpen.value = false
  await router.push('/storage')
}

function copyCorsConfiguration(): void {
  void copy(buildCorsConfigurationJson(collectCloudCorsOrigins()))
}

async function testConnection(): Promise<void> {
  busy.value = true
  result.value = null
  try {
    savePreferences()
    for (const field of provider.value.credentialFields) {
      await saveCredential(field.id)
    }
    await resumeStorageSync()
    result.value = await createActiveStorageAdapter(provider.value.id).testConnection()
  } catch (error) {
    result.value = {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  } finally {
    busy.value = false
  }
}

watch(activeStorageProviderID, (providerID) => {
  preferenceDrafts.value = initialPreferenceDrafts(providerID)
  credentialDrafts.value = emptyCredentialDrafts(providerID)
  result.value = null
  void refreshStatuses()
  void resumeStorageSync()
})

onMounted(() => void refreshStatuses())
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-storage-panel">
    <div class="flex items-start gap-2">
      <img
        v-if="provider.icon"
        :src="provider.icon"
        alt=""
        class="mt-0.5 size-5 shrink-0 object-contain"
        data-slot="storage-provider-icon"
      />
      <div>
        <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsStorage }}</h3>
        <p class="mt-0.5 text-[10px] text-muted">{{ provider.description }}</p>
      </div>
    </div>

    <label class="flex flex-col gap-1 text-[10px] text-muted">
      {{ dialogs.storageProvider }}
      <AppSelect
        v-model="activeStorageProviderID"
        :label="dialogs.storageProvider"
        :options="providerOptions"
        data-test-id="settings-storage-provider"
      />
    </label>

    <label
      v-for="field in provider.preferenceFields"
      :key="field.id"
      class="flex flex-col gap-1 text-[10px] text-muted"
    >
      {{ preferenceLabel(field) }}
      <AppInput
        v-model="preferenceDrafts[field.id]"
        :aria-label="preferenceLabel(field)"
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
        {{ credentialLabel(field) }}
      </label>
      <div class="flex gap-2">
        <AppInput
          :id="`storage-${field.id}`"
          v-model="credentialDrafts[field.id]"
          type="password"
          :aria-label="credentialLabel(field)"
          :placeholder="
            credentialStatuses[field.id] === 'configured'
              ? dialogs.keySavedReplace
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
          {{ dialogs.save }}
        </button>
        <button
          v-else-if="credentialStatuses[field.id] === 'configured'"
          type="button"
          class="rounded px-2 text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="clearCredential(field.id)"
        >
          {{ dialogs.clear }}
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
      {{ dialogs.testConnection }}
    </button>

    <button
      v-if="provider.id === 's3-compatible'"
      type="button"
      class="rounded px-3 py-1.5 text-[11px] text-muted hover:bg-hover hover:text-surface"
      @click="copyCorsConfiguration"
    >
      {{ copied ? dialogs.copied : dialogs.copyStorageCors }}
    </button>

    <button
      type="button"
      class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover disabled:text-muted disabled:opacity-50"
      :disabled="!configured"
      data-test-id="settings-storage-open-workspace"
      @click="openWorkspace"
    >
      {{ dialogs.openStorageWorkspace }}
    </button>

    <p
      v-if="result"
      class="rounded border border-border bg-panel px-2 py-1.5 text-[10px] text-muted data-[state=success]:text-success data-[state=error]:text-danger"
      :data-state="result.ok ? 'success' : 'error'"
      role="status"
    >
      {{ result.message }}
    </p>
  </section>
</template>
