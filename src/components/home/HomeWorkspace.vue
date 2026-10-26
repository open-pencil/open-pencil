<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useDocumentWorkspace } from '@open-pencil/vue/document/workspace'
import { useI18n } from '@open-pencil/vue/i18n'

import { CLOUD_INCLUDED, CLOUD_STORAGE_PROVIDER_ID } from '@/app/cloud/integration'
import { useHomeLocations } from '@/app/home/locations'
import { useDateFormat } from '@/app/i18n/date'
import {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageDocument,
  type StorageLocation
} from '@/app/integrations/storage'
import type { RecentDocument } from '@/app/recent-files'
import {
  matchingRecentFiles,
  openRecentDocument,
  useRecentFilesWorkspace
} from '@/app/recent-files/workspace'
import { useCredentialSettings } from '@/app/settings/credentials/preferences/use'
import { openSettingsDialog } from '@/app/settings/dialog'
import { createStoredDocument } from '@/app/storage/workspace/create'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import { CloudSharedSection, CloudWorkspaceSection } from '@/components/cloud/integration'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import HomeLayout from '@/components/home/HomeLayout.vue'
import RecentFilesSection from '@/components/home/recent/RecentFilesSection.vue'
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import HomeLocationMenu from '@/components/home/sidebar/HomeLocationMenu.vue'
import HomeSidebar from '@/components/home/sidebar/HomeSidebar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const { locale, storage, files, common, settings, credentials } = useI18n()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const query = ref('')
const openError = ref<string | null>(null)
const storageConfigured = ref(storagePreferencesComplete(activeStorageProviderID.value))
const places = useHomeLocations()

/** A new design lands in the place Home shows: a Cloud workspace, the bucket, or a local file. */
function newDocument() {
  const target = newDesignTarget.value
  if (target) void createStoredDocument(target.location)
  else emit('new-document')
}

const workspace = useRecentFilesWorkspace()

const documents = workspace.documents

const storageWorkspace = useDocumentWorkspace<StorageDocument>({
  source: createStorageWorkspaceSource((snapshot) => {
    storageConfigured.value = snapshot.configured
  }),
  refreshInterval: 60_000,
  previewConcurrency: 6
})
const storageDocuments = storageWorkspace.documents
const storageLoading = storageWorkspace.loading
// Paused credential access has its own fix, so the card offers it instead of the raw native error.
const credentialAccess = useCredentialSettings()
async function retryCredentialAccess() {
  await credentialAccess.retry()
  if (!credentialAccess.paused.value) await storageWorkspace.refresh()
}
const storageError = computed(() => {
  const error = storageWorkspace.error.value
  if (error == null) return null
  return error instanceof Error ? error.message : String(error)
})
const storageDescription = computed(() => {
  const provider = storageProviderRegistry.get(activeStorageProviderID.value)
  const preferences = readStoragePreferences(activeStorageProviderID.value)
  const bucket = preferences.bucket?.trim()
  const endpoint = preferences.endpoint?.trim()
  let label = provider.label
  if (endpoint) {
    try {
      const hostname = new URL(endpoint).hostname
      if (hostname.endsWith('.r2.cloudflarestorage.com')) label = storage.value.providerR2
      else if (hostname.includes('amazonaws.com')) label = storage.value.providerAmazonS3
      else if (hostname.includes('backblazeb2.com')) label = storage.value.providerBackblaze
      else if (hostname) label = storage.value.providerS3
    } catch {
      label = provider.label
    }
  }
  return bucket ? `${label} · ${bucket}` : label
})
/** The storage bucket as the sidebar lists it, or a prompt to set it up. */
const sidebarStorage = computed(() => {
  if (!storageConfigured.value)
    return { label: storage.value.workspace, detail: settings.value.notConfigured }
  const bucket = readStoragePreferences(activeStorageProviderID.value).bucket?.trim()
  return { label: bucket || storage.value.workspace, detail: storageDescription.value }
})
/** Where New design creates, named on the button; a local file when this is null. */
const newDesignTarget = computed<{ location: StorageLocation; label: string } | null>(() => {
  const workspace = places.workspace.value
  const serverId = places.serverId.value
  if (workspace && serverId && workspace.role !== 'viewer') {
    return {
      location: {
        providerId: CLOUD_STORAGE_PROVIDER_ID,
        profileId: serverId,
        containerId: workspace.id
      },
      label: workspace.name
    }
  }
  // Shared documents belong to other people's workspaces, so a new one goes to the person's own.
  const own = places.workspaces.value.find((entry) => entry.role !== 'viewer')
  if (places.location.value.kind === 'shared' && own && serverId) {
    return {
      location: { providerId: CLOUD_STORAGE_PROVIDER_ID, profileId: serverId, containerId: own.id },
      label: own.name
    }
  }
  if (places.location.value.kind === 'storage' && storageConfigured.value) {
    return {
      location: { providerId: activeStorageProviderID.value },
      label: sidebarStorage.value.label
    }
  }
  return null
})
const storagePreviewURL = storageWorkspace.previewURL
const vStoragePreview = storageWorkspace.previewDirective
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase(locale.value))
const filteredRecentFiles = computed(() =>
  matchingRecentFiles(documents.value, normalizedQuery.value, locale.value)
)
const filteredStorageDocuments = computed(() => {
  if (!normalizedQuery.value) return storageDocuments.value
  return storageDocuments.value.filter((document) =>
    document.name.toLocaleLowerCase(locale.value).includes(normalizedQuery.value)
  )
})
const noSearchMatches = computed(
  () =>
    Boolean(normalizedQuery.value) &&
    filteredRecentFiles.value.length === 0 &&
    filteredStorageDocuments.value.length === 0
)

async function openRecent(document: RecentDocument): Promise<void> {
  openError.value = null
  try {
    // Before the storage list first loads, an empty list would hide the revision to check.
    const listed = storageWorkspace.lastRefreshedAt.value ? storageDocuments.value : undefined
    await openRecentDocument(document, listed)
  } catch (error) {
    openError.value = error instanceof Error ? error.message : String(error)
  }
}

async function openStorageDocument(document: StorageDocument): Promise<void> {
  openError.value = null
  try {
    await openStorageDocumentInNewTab(document)
  } catch (error) {
    openError.value = error instanceof Error ? error.message : String(error)
  }
}

const dates = useDateFormat()
/** A file's last change; a file that never reported one shows nothing. */
function formattedDate(updatedAt: string): string {
  return Date.parse(updatedAt) === 0 ? '' : dates.format(updatedAt, 'dateTime')
}
</script>

<template>
  <HomeLayout data-test-id="recent-files-home">
    <template #sidebar>
      <HomeSidebar
        :cloud="CLOUD_INCLUDED"
        :active="places.active.value"
        :account="places.account.value"
        :workspaces="places.workspaces.value"
        :storage="sidebarStorage"
        @select="places.select"
        @connect="places.connect"
        @open-account="places.openAccount"
        @storage-settings="places.storageSettings"
        @switch-server="places.connect"
        @new-workspace="places.newWorkspace"
        @sign-out="places.signOut"
      />
    </template>
    <template #locations>
      <HomeLocationMenu
        :cloud="CLOUD_INCLUDED"
        :active="places.active.value"
        :account="places.account.value"
        :workspaces="places.workspaces.value"
        :storage="sidebarStorage"
        @select="places.select"
        @connect="places.connect"
        @new-workspace="places.newWorkspace"
      />
    </template>
    <HomeSearchActions
      v-model="query"
      :destination="newDesignTarget?.label ?? null"
      @new-document="newDocument"
    />

    <p v-if="openError" class="mb-4 text-xs text-error" role="alert">{{ openError }}</p>
    <!-- Nothing until Cloud says which workspace Home opens on. -->
    <template v-if="places.settling.value" />
    <CloudWorkspaceSection
      v-else-if="places.workspace.value && places.serverId.value"
      :server-id="places.serverId.value"
      :workspace="places.workspace.value"
      :query="normalizedQuery"
    />
    <CloudSharedSection
      v-else-if="places.location.value.kind === 'shared' && places.serverId.value"
      :server-id="places.serverId.value"
      :query="normalizedQuery"
    />
    <template v-else>
      <p
        v-if="noSearchMatches"
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
      >
        {{ files.noMatchingFiles({ query: query.trim() }) }}
      </p>

      <RecentFilesSection
        v-if="!noSearchMatches && places.location.value.kind === 'recent'"
        v-model:view="view"
        :workspace="workspace"
        :documents="filteredRecentFiles"
        :query="normalizedQuery"
        @open="openRecent"
      />

      <section v-if="places.location.value.kind === 'storage'">
        <div class="mb-3 flex items-start gap-3">
          <div class="min-w-0">
            <h2 class="text-base font-semibold">{{ storage.workspace }}</h2>
            <p class="mt-0.5 truncate text-xs text-muted sm:whitespace-normal">
              {{ storageDescription }}
            </p>
          </div>
          <div class="ml-auto flex shrink-0 items-center gap-1">
            <IconButton
              :label="common.refresh"
              class="size-10 sm:size-7"
              @click="storageWorkspace.refresh"
            >
              <icon-lucide-refresh-cw class="size-3.5" />
            </IconButton>
            <IconButton
              :label="settings.title"
              class="size-10 sm:size-7"
              @click="openSettingsDialog('account')"
            >
              <icon-lucide-settings-2 class="size-3.5" />
            </IconButton>
          </div>
        </div>

        <div
          v-if="storageLoading && storageDocuments.length === 0"
          class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
          :aria-label="storage.loadingWorkspace"
        >
          <div
            v-for="index in 3"
            :key="index"
            class="min-w-0 animate-pulse motion-reduce:animate-none"
          >
            <div class="aspect-video rounded-lg border border-border bg-panel-field" />
            <div class="mt-2 h-3 w-2/3 rounded bg-panel-field" />
            <div class="mt-1.5 h-2.5 w-1/3 rounded bg-panel-field" />
          </div>
        </div>

        <div
          v-else-if="storageError && storageDocuments.length === 0"
          class="rounded-lg border border-error/40 px-4 py-6 text-center"
          role="alert"
        >
          <template v-if="credentialAccess.paused.value">
            <p class="text-xs text-error">{{ credentials.accessPaused }}</p>
            <AppButton
              variant="outline"
              class="mt-3"
              :loading="credentialAccess.busy.value"
              data-test-id="home-storage-retry-access"
              @click="retryCredentialAccess"
            >
              {{ credentials.retryAccess }}
            </AppButton>
          </template>
          <template v-else>
            <p class="text-xs text-error">{{ storageError }}</p>
            <AppButton variant="outline" class="mt-3" @click="storageWorkspace.refresh">
              {{ common.refresh }}
            </AppButton>
          </template>
        </div>

        <div
          v-else-if="filteredStorageDocuments.length && view === 'grid'"
          class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
        >
          <DocumentEntry
            v-for="document in filteredStorageDocuments"
            :key="document.id"
            v-storage-preview="document.id"
            :name="document.name"
            :metadata="formattedDate(document.updatedAt)"
            :previewURL="storagePreviewURL(document.id)"
            @open="openStorageDocument(document)"
          />
        </div>

        <div
          v-else-if="filteredStorageDocuments.length"
          class="overflow-hidden rounded-lg border border-border"
        >
          <DocumentEntry
            v-for="document in filteredStorageDocuments"
            :key="document.id"
            view="list"
            :name="document.name"
            :metadata="formattedDate(document.updatedAt)"
            @open="openStorageDocument(document)"
          />
        </div>

        <div
          v-else-if="!storageConfigured"
          class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
        >
          <p>{{ storage.notConfigured }}</p>
          <AppButton variant="outline" class="mt-3" @click="openSettingsDialog('account')">
            {{ settings.title }}
          </AppButton>
        </div>

        <div
          v-else-if="!normalizedQuery"
          class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
        >
          {{ storage.emptyStorageWorkspace }}
        </div>
      </section>
    </template>
  </HomeLayout>
</template>
