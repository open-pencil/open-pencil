<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@open-pencil/vue'

import { useNotificationMessages } from '@/app/i18n/notifications'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  readStoragePreferences,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  writeStoragePreference
} from '@/app/integrations/storage'
import { useCloudStorageSettings } from '@/app/integrations/storage/cloud/settings'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { credentialRef } from '@/app/settings/credentials/reference'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { toast } from '@/app/shell/ui'
import { resumeStorageSync } from '@/app/storage/sync'
import CloudEntitlementsSummary from '@/components/settings/storage/CloudEntitlementsSummary.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'

const { dialogs } = useI18n()
const notifications = useNotificationMessages()
const router = useRouter()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const providerOptions = storageProviderRegistry.list().map((registration) => ({
  value: registration.id,
  label: registration.label
}))
const preferenceDrafts = ref<Record<string, string>>({
  ...readStoragePreferences(provider.value.id)
})
const credentialDrafts = ref<Record<string, string>>({})
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const busy = ref(false)
const cloudSettings = useCloudStorageSettings()
const isCloudProvider = computed(() => provider.value.id === 'openpencil-cloud')
const cloudWorkspace = computed({
  get: () => preferenceDrafts.value['workspace-id'] ?? '',
  set: (value: string) => {
    preferenceDrafts.value['workspace-id'] = value
    cloudSettings.selectWorkspace(value)
  }
})
const configured = computed(
  () =>
    storagePreferencesComplete(provider.value.id) &&
    provider.value.credentialFields.every(
      (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
    )
)

function preferenceLabel(field: string): string {
  if (field === 'server-url') return 'Server URL'
  if (field === 'workspace-id') return 'Workspace ID'
  if (field === 'endpoint') return dialogs.value.storageEndpoint
  if (field === 'bucket') return dialogs.value.storageBucket
  if (field === 'region') return dialogs.value.storageRegion
  return field
}

function credentialLabel(field: string): string {
  if (field === 'access-key-id') return dialogs.value.storageAccessKeyID
  if (field === 'secret-access-key') return dialogs.value.storageSecretAccessKey
  return field
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

async function connectCloud(): Promise<void> {
  try {
    cloudSettings.serverURL.value = preferenceDrafts.value['server-url'] ?? ''
    await cloudSettings.connect()
    preferenceDrafts.value = { ...readStoragePreferences(provider.value.id) }
    const state = cloudSettings.state.value
    if (state?.session) toast.info(`Connected as ${state.session.user.email}`)
    else toast.info('Cloud server connected. Sign in to continue.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function signInCloud(providerID: 'apple' | 'google'): Promise<void> {
  try {
    await cloudSettings.signIn(providerID)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function signOutCloud(): Promise<void> {
  try {
    await cloudSettings.signOut()
    toast.info('Signed out of OpenPencil Cloud.')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function testConnection(): Promise<void> {
  busy.value = true
  try {
    savePreferences()
    for (const field of provider.value.credentialFields) {
      await saveCredential(field.id)
    }
    await resumeStorageSync()
    const connection = await createActiveStorageAdapter(provider.value.id).testConnection()
    if (connection.ok) toast.info(notifications.value.storageConnected)
    else toast.error(notifications.value.storageConnectionFailed({ error: connection.message }))
  } catch (error) {
    toast.error(
      notifications.value.storageConnectionFailed({
        error: error instanceof Error ? error.message : String(error)
      })
    )
  } finally {
    busy.value = false
  }
}

watch(activeStorageProviderID, (providerID) => {
  preferenceDrafts.value = { ...readStoragePreferences(providerID) }
  credentialDrafts.value = {}
  void refreshStatuses()
})

onMounted(() => void refreshStatuses())
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-storage-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsStorage }}</h3>
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

    <div v-if="isCloudProvider" class="flex flex-col gap-2 rounded border border-border p-2">
      <button
        type="button"
        class="rounded bg-hover px-2 py-1.5 text-[10px] text-surface hover:bg-active"
        :disabled="cloudSettings.isLoading.value"
        @click="connectCloud"
      >
        Connect to server
      </button>
      <template v-if="cloudSettings.state.value">
        <div
          v-if="cloudSettings.state.value.session"
          class="flex items-center justify-between gap-2"
        >
          <span class="truncate text-[10px] text-muted">
            {{ cloudSettings.state.value.session.user.email }}
          </span>
          <button
            type="button"
            class="rounded px-2 py-1 text-[10px] text-muted hover:bg-hover"
            @click="signOutCloud"
          >
            Sign out
          </button>
        </div>
        <div v-else class="flex gap-2">
          <button
            v-for="socialProvider in cloudSettings.state.value.discovery?.authentication
              .socialProviders ?? []"
            :key="socialProvider"
            type="button"
            class="flex-1 rounded bg-hover px-2 py-1.5 text-[10px] capitalize text-surface hover:bg-active"
            @click="signInCloud(socialProvider)"
          >
            Sign in with {{ socialProvider }}
          </button>
        </div>
        <AppSelect
          v-if="cloudSettings.workspaceOptions.value.length"
          v-model="cloudWorkspace"
          label="Cloud workspace"
          :options="cloudSettings.workspaceOptions.value"
        />
        <CloudEntitlementsSummary
          v-if="cloudWorkspace"
          :entitlements="cloudSettings.entitlements.value"
          :loading="cloudSettings.entitlementsLoading.value"
          :error="cloudSettings.entitlementsError.value"
          @retry="cloudSettings.refreshEntitlements"
        />
      </template>
    </div>

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
      type="button"
      class="rounded border border-border px-3 py-1.5 text-[11px] font-medium text-surface hover:bg-hover disabled:text-muted disabled:opacity-50"
      :disabled="!configured"
      data-test-id="settings-storage-open-workspace"
      @click="openWorkspace"
    >
      {{ dialogs.openStorageWorkspace }}
    </button>
  </section>
</template>
