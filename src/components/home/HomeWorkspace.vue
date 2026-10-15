<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { useDocumentWorkspace, useI18n, useViewportKind } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  readStoragePreferences,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageDocument
} from '@/app/integrations/storage'
import {
  clearRecentFiles,
  forgetRecentDocument,
  homeFileFilter,
  homeFileType,
  homeSection,
  loadRecentFileThumbnail,
  matchesHomeFileFilter,
  recentFiles,
  type HomeFileFilter,
  type RecentDocument
} from '@/app/recent-files'
import { useCredentialSettings } from '@/app/settings/credentials/preferences/use'
import { openSettingsDialog } from '@/app/settings/dialog'
import { openFileFromPath } from '@/app/shell/menu/use'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppTabsContent from '@/components/ui/tabs/AppTabsContent.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const { panels, locale, storage, files, common, settings, credentials } = useI18n()
const { isMobile } = useViewportKind()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const query = ref('')
const openError = ref<string | null>(null)
const storageConfigured = ref(storagePreferencesComplete(activeStorageProviderID.value))

const workspace = useDocumentWorkspace<RecentDocument>({
  source: {
    async refresh() {
      return recentFiles.value
    },
    loadPreview(documentId) {
      const document = recentFiles.value.find((candidate) => candidate.id === documentId)
      if (!document) return Promise.resolve(null)
      if (document.kind === 'local') return loadRecentFileThumbnail(document.path)
      return createStorageWorkspaceSource(() => undefined).loadPreview(document.documentId)
    }
  },
  refreshOnFocus: false,
  refreshOnReconnect: false,
  previewConcurrency: 2
})

const documents = workspace.documents
const previewURL = workspace.previewURL
const vWorkspacePreview = workspace.previewDirective

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
const storagePreviewURL = storageWorkspace.previewURL
const vStoragePreview = storageWorkspace.previewDirective
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase(locale.value))
// Figma's Recents: one list at a time, filtered by file type as well as by the search.
const section = computed({
  get: () => homeSection.value,
  set: (value: string) => {
    if (value === 'recent' || value === 'storage') homeSection.value = value
  }
})
const fileFilterOptions = computed<{ value: HomeFileFilter; label: string }[]>(() => [
  { value: 'all', label: files.value.allFiles },
  { value: 'figma', label: files.value.figmaFiles },
  { value: 'pencil', label: files.value.pencilFiles },
  { value: 'other', label: files.value.otherFiles }
])
const filtering = computed(() => Boolean(normalizedQuery.value) || homeFileFilter.value !== 'all')
const filterDescription = computed(
  () =>
    query.value.trim() ||
    fileFilterOptions.value.find((option) => option.value === homeFileFilter.value)?.label ||
    ''
)
const filteredRecentFiles = computed(() =>
  documents.value.filter((document) => {
    const location = document.kind === 'local' ? document.path : document.documentId
    // Storage documents are always .fig files.
    const type = document.kind === 'local' ? homeFileType(document.path) : 'figma'
    return (
      matchesHomeFileFilter(type, homeFileFilter.value) &&
      `${document.name}\n${location}`
        .toLocaleLowerCase(locale.value)
        .includes(normalizedQuery.value)
    )
  })
)
const filteredStorageDocuments = computed(() =>
  storageDocuments.value.filter(
    (document) =>
      matchesHomeFileFilter('figma', homeFileFilter.value) &&
      document.name.toLocaleLowerCase(locale.value).includes(normalizedQuery.value)
  )
)
const hasRecentFiles = computed(() => documents.value.length > 0)
// A search or filter that leaves nothing says so, even over an empty list, or the tab is blank.
const noRecentMatches = computed(() => filtering.value && filteredRecentFiles.value.length === 0)
const noStorageMatches = computed(
  () =>
    filtering.value &&
    storageConfigured.value &&
    !storageLoading.value &&
    filteredStorageDocuments.value.length === 0
)

watch(recentFiles, () => void workspace.invalidate())

async function openRecent(document: RecentDocument): Promise<void> {
  openError.value = null
  try {
    if (document.kind === 'local') {
      await openFileFromPath(document.path)
      return
    }
    const storageDocument = storageDocuments.value.find(
      (candidate) => candidate.id === document.documentId
    )
    await openStorageDocumentInNewTab(
      storageDocument ?? {
        id: document.documentId,
        name: document.name,
        updatedAt: document.updatedAt
      }
    )
  } catch (error) {
    forgetRecentDocument(document.id)
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

function formattedDate(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (date.getTime() === 0) return ''
  return date.toLocaleString(locale.value)
}
</script>

<template>
  <main
    class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-panel text-surface"
    data-test-id="recent-files-home"
  >
    <section
      class="mx-auto flex w-full max-w-7xl flex-col pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 sm:py-5"
    >
      <icon-brand-lockup
        role="img"
        aria-label="OpenPencil"
        class="mb-5 block h-8 w-auto text-surface"
      />
      <HomeSearchActions v-model="query" @new-document="emit('new-document')" />

      <p v-if="openError" class="mb-4 text-xs text-error" role="alert">{{ openError }}</p>

      <h1 class="mb-4 text-base font-semibold">{{ files.recents }}</h1>
      <AppTabsRoot v-model="section" :ui="{ root: 'flex-none' }">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <AppTabsList :label="files.recents" :ui="{ list: 'p-0' }">
            <AppTabsTrigger value="recent" :ui="{ trigger: 'px-3 text-xs' }">{{
              files.recentlyViewed
            }}</AppTabsTrigger>
            <AppTabsTrigger value="storage" :ui="{ trigger: 'px-3 text-xs' }">{{
              files.storageList
            }}</AppTabsTrigger>
          </AppTabsList>
          <div class="ml-auto flex min-w-0 items-center gap-1">
            <template v-if="section === 'storage'">
              <span class="hidden min-w-0 truncate text-xs text-muted sm:inline">{{
                storageDescription
              }}</span>
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
                @click="openSettingsDialog('storage')"
              >
                <icon-lucide-settings-2 class="size-3.5" />
              </IconButton>
            </template>
            <IconButton
              v-else-if="hasRecentFiles"
              :label="common.clear"
              class="size-10 sm:size-7"
              data-test-id="recent-files-clear"
              @click="clearRecentFiles"
            >
              <icon-lucide-trash-2 class="size-3.5" />
            </IconButton>
            <AppSelect
              v-model="homeFileFilter"
              :options="fileFilterOptions"
              :label="files.fileType"
            />
            <SegmentedControl
              v-model="view"
              required
              :label="files.recents"
              :size="isMobile ? 'touch' : 'md'"
              :options="[
                { value: 'grid', label: panels.gridView },
                { value: 'list', label: panels.listView }
              ]"
            >
              <template #option="{ option }">
                <icon-lucide-layout-grid v-if="option.value === 'grid'" class="size-3.5" />
                <icon-lucide-list v-else class="size-3.5" />
              </template>
            </SegmentedControl>
          </div>
        </div>

        <AppTabsContent value="recent">
          <p
            v-if="noRecentMatches"
            class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
          >
            {{ files.noMatchingFiles({ query: filterDescription }) }}
          </p>
          <div
            v-if="filteredRecentFiles.length && view === 'grid'"
            class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
          >
            <DocumentEntry
              v-for="document in filteredRecentFiles"
              :key="document.id"
              v-workspace-preview="document.id"
              :name="document.name"
              :metadata="formattedDate(document.updatedAt)"
              :previewURL="previewURL(document.id)"
              @open="openRecent(document)"
            />
          </div>

          <div
            v-else-if="filteredRecentFiles.length"
            class="overflow-hidden rounded-lg border border-border"
          >
            <DocumentEntry
              v-for="document in filteredRecentFiles"
              :key="document.id"
              view="list"
              :name="document.name"
              :metadata="formattedDate(document.updatedAt)"
              @open="openRecent(document)"
            />
          </div>

          <div
            v-else-if="!filtering"
            class="rounded-lg border border-dashed border-border px-4 py-4 text-center sm:py-6"
          >
            <p class="text-xs font-medium">{{ files.noRecentFiles }}</p>
            <p class="mt-1 text-xs text-muted">{{ files.noRecentFilesDescription }}</p>
          </div>
        </AppTabsContent>

        <AppTabsContent value="storage">
          <p
            v-if="noStorageMatches"
            class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
          >
            {{ files.noMatchingFiles({ query: filterDescription }) }}
          </p>
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
            <AppButton variant="outline" class="mt-3" @click="openSettingsDialog('storage')">
              {{ settings.title }}
            </AppButton>
          </div>

          <div
            v-else-if="!filtering"
            class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
          >
            {{ storage.emptyStorageWorkspace }}
          </div>
        </AppTabsContent>
      </AppTabsRoot>
    </section>
  </main>
</template>
