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
  loadRecentFileThumbnail,
  recentFiles,
  type RecentDocument
} from '@/app/recent-files'
import { openSettingsDialog } from '@/app/settings/dialog'
import { openFileFromPath } from '@/app/shell/menu/use'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const { panels, locale, storage, files, common, settings } = useI18n()
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
const filteredRecentFiles = computed(() => {
  if (!normalizedQuery.value) return documents.value
  return documents.value.filter((document) =>
    `${document.name}\n${document.kind === 'local' ? document.path : document.documentId}`
      .toLocaleLowerCase(locale.value)
      .includes(normalizedQuery.value)
  )
})
const filteredStorageDocuments = computed(() => {
  if (!normalizedQuery.value) return storageDocuments.value
  return storageDocuments.value.filter((document) =>
    document.name.toLocaleLowerCase(locale.value).includes(normalizedQuery.value)
  )
})
const hasRecentFiles = computed(() => documents.value.length > 0)
const noSearchMatches = computed(
  () =>
    Boolean(normalizedQuery.value) &&
    filteredRecentFiles.value.length === 0 &&
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
    class="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto bg-app text-surface"
    data-test-id="recent-files-home"
  >
    <section
      class="mx-auto flex w-full max-w-7xl flex-col pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] sm:px-6 sm:py-5"
    >
      <HomeSearchActions v-model="query" @new-document="emit('new-document')" />

      <p v-if="openError" class="mb-4 text-xs text-danger" role="alert">{{ openError }}</p>
      <p
        v-if="noSearchMatches"
        class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted"
      >
        {{ files.noMatchingFiles({ query: query.trim() }) }}
      </p>

      <section v-if="!noSearchMatches">
        <div class="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2">
          <div class="col-span-2 min-w-0 sm:col-span-1">
            <h1 class="text-base font-semibold">{{ files.recentFiles }}</h1>
            <p class="mt-0.5 text-pretty text-xs text-muted">{{ files.recentFilesDescription }}</p>
          </div>
          <div class="col-span-2 flex items-center justify-end gap-1 sm:col-span-1">
            <IconButton
              v-if="hasRecentFiles"
              :label="common.clear"
              class="size-10 sm:size-7"
              data-test-id="recent-files-clear"
              @click="clearRecentFiles"
            >
              <icon-lucide-trash-2 class="size-3.5" />
            </IconButton>
            <SegmentedControl
              v-model="view"
              required
              :label="files.recentFiles"
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
          v-else-if="!normalizedQuery"
          class="rounded-lg border border-dashed border-border px-4 py-4 text-center sm:py-6"
        >
          <p class="text-xs font-medium">{{ files.noRecentFiles }}</p>
          <p class="mt-1 text-xs text-muted">{{ files.noRecentFilesDescription }}</p>
        </div>
      </section>

      <section class="mt-7">
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
              @click="openSettingsDialog('storage')"
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
          <div v-for="index in 3" :key="index" class="min-w-0 animate-pulse">
            <div class="aspect-video rounded-lg border border-border bg-panel-field" />
            <div class="mt-2 h-3 w-2/3 rounded bg-panel-field" />
            <div class="mt-1.5 h-2.5 w-1/3 rounded bg-panel-field" />
          </div>
        </div>

        <div
          v-else-if="storageError && storageDocuments.length === 0"
          class="rounded-lg border border-danger/40 px-4 py-6 text-center"
          role="alert"
        >
          <p class="text-xs text-danger">{{ storageError }}</p>
          <AppButton variant="outline" class="mt-3" @click="storageWorkspace.refresh">
            {{ common.refresh }}
          </AppButton>
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
          v-else-if="!normalizedQuery"
          class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
        >
          {{ storage.emptyStorageWorkspace }}
        </div>
      </section>
    </section>
  </main>
</template>
