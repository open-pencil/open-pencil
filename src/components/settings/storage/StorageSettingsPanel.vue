<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useRouter } from 'vue-router'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle
} from 'reka-ui'
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
import { backupToCloud, setBackupToCloud } from '@/app/storage/backup'
import { disconnectStorageTarget } from '@/app/storage/disconnect'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { resumeStorageSync } from '@/app/storage/sync'
import { currentTargetIdFor } from '@/app/storage/target'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import Tip from '@/components/ui/Tip.vue'
import { AppAlertDialogRoot, AppDialogBody, AppDialogFooter } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const backupEnabled = backupToCloud
const router = useRouter()
const { copy, copied } = useClipboard()
const { copy: copyErrorText, copied: errorCopied } = useClipboard()
/**
 * Which provider's FORM is on screen — not where documents go.
 *
 * The dropdown used to be `activeStorageProviderID` itself, so choosing an entry
 * to read its setup instructions silently repointed sync at a provider with no
 * credentials, and every document stopped uploading. Inspecting a provider is
 * not a decision; only `activate()` is.
 */
const panelProviderID = ref<StorageProviderID>(activeStorageProviderID.value)
const provider = computed(() => storageProviderRegistry.get(panelProviderID.value))
const activeProvider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const isActiveProvider = computed(() => panelProviderID.value === activeStorageProviderID.value)
const providerOptions = computed(() =>
  storageProviderRegistry.list().map((registration) => ({
    value: registration.id,
    label: registration.label
  }))
)

/**
 * Switching provider unhooks this device from the old destination.
 *
 * Until this existed the dropdown changed a setting and nothing else: rows
 * stayed pinned to a target the workspace no longer lists, so a fault there
 * raised a status for documents the UI would not show and offered no way to
 * reach. `disconnectStorageTarget` is the transition that was already written
 * for this and never called — it keeps every document that has local bytes,
 * drops only cards that were listed but never downloaded, and removes nothing
 * from the bucket.
 */
const switchRequest = ref<{ to: StorageProviderID; from: string; pending: number } | null>(null)
/**
 * Open state is separate from the payload on purpose.
 *
 * `AlertDialogAction` dismisses the dialog as part of the same click that runs
 * the confirm handler. With one ref for both, the close cleared the request
 * before the handler read it, so confirming did nothing at all — silently, with
 * no error to notice.
 */
const switchDialogOpen = ref(false)

/**
 * Activation is the commit point, and the only destructive one.
 *
 * The provider picker only swaps the form. For an inactive provider, the primary
 * action tests the connection and reaches this point only after the test passes.
 * Changing providers is a rare, deliberate act, so leaving an existing target
 * still gets a confirmation that names what happens to its documents.
 */
async function requestActivation(): Promise<void> {
  const to = panelProviderID.value
  if (to === activeStorageProviderID.value) return
  const fromTarget = currentTargetIdFor(activeStorageProviderID.value)
  // No configured destination to leave — activate without ceremony. There is
  // nothing to disconnect and no documents to explain.
  if (!fromTarget) {
    activeStorageProviderID.value = to
    void resumeStorageSync()
    return
  }
  const metas = await getLocalCanvasStore().listMetas(true)
  const pending = metas.filter(
    (meta) =>
      meta.syncTargetId === fromTarget &&
      !meta.tombstoned &&
      meta.bodyId !== null &&
      meta.bodyId !== meta.syncedBodyId
  ).length
  switchRequest.value = { to, from: activeProvider.value.label, pending }
  switchDialogOpen.value = true
}

async function confirmActivation(): Promise<void> {
  const request = switchRequest.value
  if (!request) return
  const fromTarget = currentTargetIdFor(activeStorageProviderID.value)
  switchDialogOpen.value = false
  if (fromTarget) await disconnectStorageTarget(fromTarget)
  activeStorageProviderID.value = request.to
  switchRequest.value = null
  void resumeStorageSync()
}

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
const backupDescription = computed(() => {
  if (!backupEnabled.value) return dialogs.value.backUpToCloudOff
  return configured.value ? dialogs.value.backUpToCloudOn : dialogs.value.backUpToCloudUnconfigured
})

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
  await router.push('/')
}

function copyCorsConfiguration(): void {
  void copy(buildCorsConfigurationJson(collectCloudCorsOrigins()))
}

/**
 * Separate clipboard instance from the CORS button — a shared `copied` flag
 * would flip both labels at once.
 *
 * Preference fields only; credentials are never read here.
 */
function copyResultError(): void {
  if (!result.value || result.value.ok) return
  const preferences = readStoragePreferences(provider.value.id)
  void copyErrorText(
    [
      'OpenPencil storage connection test failed',
      `Provider: ${provider.value.label} (${provider.value.id})`,
      ...Object.entries(preferences)
        .filter(([, value]) => value)
        .map(([field, value]) => `${field}: ${value}`),
      `Time: ${new Date().toISOString()}`,
      '',
      result.value.message
    ].join('\n')
  )
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
    if (result.value.ok && !isActiveProvider.value) await requestActivation()
  } catch (error) {
    result.value = {
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  } finally {
    busy.value = false
  }
}

// Keyed to the FORM, not the destination: selecting a provider loads its saved
// settings. `resumeStorageSync` is deliberately not called here — reading a
// provider's setup is not a reason to touch the queue.
watch(panelProviderID, (providerID) => {
  preferenceDrafts.value = initialPreferenceDrafts(providerID)
  credentialDrafts.value = emptyCredentialDrafts(providerID)
  result.value = null
  void refreshStatuses()
})

onMounted(() => void refreshStatuses())
</script>

<template>
  <section class="flex flex-col gap-3" data-test-id="settings-storage-panel">
    <div class="flex flex-wrap items-start gap-3">
      <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsStorage }}</h3>

      <!--
        Pause without dismantling. Clearing the API key to stop syncing means
        re-entering it to resume, and it destroys the one setting that is
        genuinely annoying to recreate.
      -->
      <div
        class="ml-auto flex min-w-0 max-w-md flex-1 items-start gap-2 rounded border border-border bg-panel px-3 py-2"
      >
        <AppSwitch
          :model-value="backupEnabled"
          :label="dialogs.backUpToCloud"
          data-test-id="settings-storage-backup-toggle"
          @update:model-value="setBackupToCloud"
        />
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-surface">{{ dialogs.backUpToCloud }}</p>
          <p class="text-[10px] leading-snug text-muted">
            {{ backupDescription }}
          </p>
        </div>
      </div>
    </div>

    <label class="flex flex-col gap-1 text-[10px] text-muted">
      {{ dialogs.storageProvider }}
      <AppSelect
        v-model="panelProviderID"
        :label="dialogs.storageProvider"
        :options="providerOptions"
        data-test-id="settings-storage-provider"
      />
    </label>

    <!--
      Provider identity and setup guidance follow the picker: they describe the
      consequence of the selection, so showing them above it read as though the
      branding were the panel's subject rather than the chosen provider.
    -->
    <div class="flex items-start gap-2">
      <img
        v-if="provider.icon"
        :src="provider.icon"
        alt=""
        class="mt-0.5 size-5 shrink-0 object-contain"
        data-slot="storage-provider-icon"
      />
      <div>
        <p class="text-[10px] text-muted">{{ provider.description }}</p>
        <a
          v-if="provider.helpUrl"
          :href="provider.helpUrl"
          target="_blank"
          rel="noreferrer"
          class="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-accent hover:underline"
          data-test-id="settings-storage-help-link"
        >
          {{ provider.helpLabel ?? provider.helpUrl }}
          <icon-lucide-external-link class="size-2.5" />
        </a>
        <p v-if="provider.pricingNote" class="mt-0.5 text-[10px] text-muted">
          {{ provider.pricingNote }}
        </p>
        <!--
          Honesty about what a destination cannot do: only called out when the
          answer is "nothing" — a provider that detects conflicts needs no
          warning, and 'prevent' does not exist on this matrix yet.
        -->
        <p
          v-if="provider.conflictProtection === 'none'"
          class="mt-0.5 text-[10px] text-[var(--color-warning-text)]"
          data-test-id="settings-storage-no-conflict-detection"
        >
          {{ dialogs.storageNoConflictDetection }}
        </p>
      </div>
    </div>

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
      class="mt-1 flex items-center justify-center gap-1.5 rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      :disabled="busy"
      data-test-id="settings-storage-test"
      @click="testConnection"
    >
      <icon-lucide-loader-circle v-if="busy" class="size-3 animate-spin" />
      {{
        busy
          ? dialogs.testingConnection
          : isActiveProvider
            ? dialogs.testConnection
            : dialogs.storageUseProvider({ provider: provider.label })
      }}
    </button>

    <!--
      Name the current destination before the action reports its result. The
      primary button above is the whole connect flow: it saves the form, tests
      the connection, and only then requests the provider switch. Keeping a
      second "Use" button here put the real commit below the fold.
    -->
    <p v-if="!isActiveProvider" class="text-[10px] text-muted">
      {{ dialogs.storageActiveProvider({ provider: activeProvider.label }) }}
    </p>

    <!--
      Kept with the action that produces it. This used to render after "Open
      workspace" at the very bottom of the panel, so a failed test showed its
      message below the fold and read as if nothing had happened at all.
    -->
    <div
      v-if="result"
      class="flex items-start gap-2 rounded border px-2 py-1.5"
      :class="
        result.ok
          ? 'border-border bg-panel text-success'
          : 'border-[var(--color-warning-border)] bg-[rgb(239_68_68/0.1)] text-danger'
      "
      :data-state="result.ok ? 'success' : 'error'"
      data-test-id="settings-storage-result"
      :role="result.ok ? 'status' : 'alert'"
    >
      <icon-lucide-circle-check v-if="result.ok" class="mt-px size-3 shrink-0" />
      <icon-lucide-circle-alert v-else class="mt-px size-3 shrink-0" />
      <p class="flex-1 text-[10px] leading-relaxed whitespace-pre-line select-text">
        {{ result.message }}
      </p>
      <Tip v-if="!result.ok" :label="dialogs.copyStorageError">
        <button
          type="button"
          class="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-hover hover:text-surface"
          data-test-id="settings-storage-result-copy"
          :aria-label="dialogs.copyStorageError"
          @click="copyResultError"
        >
          <icon-lucide-check v-if="errorCopied" class="size-3" />
          <icon-lucide-copy v-else class="size-3" />
        </button>
      </Tip>
    </div>

    <button
      v-if="provider.corsConfiguration === 's3'"
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

    <AppAlertDialogRoot
      v-model:open="switchDialogOpen"
      data-test-id="settings-storage-switch-dialog"
    >
      <div class="border-b border-border px-4 py-3">
        <AlertDialogTitle class="text-sm font-semibold text-surface">
          {{ dialogs.storageSwitchTitle }}
        </AlertDialogTitle>
      </div>
      <AppDialogBody>
        <AlertDialogDescription class="text-xs text-muted">
          {{ dialogs.storageSwitchBody({ from: switchRequest?.from ?? '' }) }}
        </AlertDialogDescription>
        <!--
          Only shown when there is something to lose. A standing warning about
          unsynced work on every switch would train people to click through it.
        -->
        <p
          v-if="(switchRequest?.pending ?? 0) > 0"
          class="mt-2 text-xs text-[var(--color-warning-action)]"
          data-test-id="settings-storage-switch-pending"
        >
          {{
            dialogs.storageSwitchPending({
              count: switchRequest?.pending ?? 0,
              from: switchRequest?.from ?? ''
            })
          }}
        </p>
      </AppDialogBody>
      <AppDialogFooter>
        <AlertDialogCancel as-child>
          <button type="button" class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover">
            {{ dialogs.cancel }}
          </button>
        </AlertDialogCancel>
        <AlertDialogAction as-child>
          <button
            type="button"
            class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            data-test-id="settings-storage-switch-confirm"
            @click="confirmActivation"
          >
            {{ dialogs.storageSwitchConfirm }}
          </button>
        </AlertDialogAction>
      </AppDialogFooter>
    </AppAlertDialogRoot>
  </section>
</template>
