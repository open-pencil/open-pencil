<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'

import { useDocumentWorkspace, useI18n } from '@open-pencil/vue'

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
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import Tip from '@/components/ui/Tip.vue'

const emit = defineEmits<{ 'new-document': [] }>()
const { panels, locale, storage, files, common, settings } = useI18n()
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
        <div class="mb-3">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <h1 class="text-base font-semibold">{{ files.recentFiles }}</h1>
              <p class="mt-0.5 text-pretty text-xs text-muted">
                {{ files.recentFilesDescription }}
              </p>
            </div>
            <div class="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
              <Tip v-if="hasRecentFiles" :label="common.clear">
                <button
                  type="button"
                  class="flex size-10 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface sm:size-7"
                  :aria-label="common.clear"
                  data-test-id="recent-files-clear"
                  @click="clearRecentFiles"
                >
                  <icon-lucide-trash-2 class="size-3.5" />
                </button>
              </Tip>
              <div class="flex rounded border border-border p-0.5">
                <Tip :label="panels.gridView">
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-sm text-muted hover:text-surface sm:size-7"
                    :class="{ 'bg-hover text-surface': view === 'grid' }"
                    :aria-label="panels.gridView"
                    @click="view = 'grid'"
                  >
                    <icon-lucide-layout-grid class="size-3.5" />
                  </button>
                </Tip>
                <Tip :label="panels.listView">
                  <button
                    type="button"
                    class="flex size-10 items-center justify-center rounded-sm text-muted hover:text-surface sm:size-7"
                    :class="{ 'bg-hover text-surface': view === 'list' }"
                    :aria-label="panels.listView"
                    @click="view = 'list'"
                  >
                    <icon-lucide-list class="size-3.5" />
                  </button>
                </Tip>
              </div>
            </div>
          </div>
          <div class="mt-2 flex items-center justify-end gap-1 sm:hidden">
            <Tip v-if="hasRecentFiles" :label="common.clear">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
                :aria-label="common.clear"
                data-test-id="recent-files-clear"
                @click="clearRecentFiles"
              >
                <icon-lucide-trash-2 class="size-3.5" />
              </button>
            </Tip>
            <div class="flex rounded border border-border p-0.5">
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-sm text-muted"
                :class="{ 'bg-hover text-surface': view === 'grid' }"
                :aria-label="panels.gridView"
                @click="view = 'grid'"
              >
                <icon-lucide-layout-grid class="size-3.5" />
              </button>
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-sm text-muted"
                :class="{ 'bg-hover text-surface': view === 'list' }"
                :aria-label="panels.listView"
                @click="view = 'list'"
              >
                <icon-lucide-list class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="filteredRecentFiles.length && view === 'grid'"
          class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
        >
          <button
            v-for="document in filteredRecentFiles"
            :key="document.id"
            type="button"
            class="group min-w-0 text-left"
            @click="openRecent(document)"
          >
            <div
              v-workspace-preview="document.id"
              class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field transition-colors group-hover:border-panel-focus"
            >
              <img
                v-if="previewURL(document.id)"
                :src="previewURL(document.id) ?? undefined"
                alt=""
                class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
              />
              <icon-lucide-file-image v-else class="size-8 text-muted/40" />
            </div>
            <p class="mt-2 truncate text-xs font-medium">{{ document.name }}</p>
            <p class="mt-0.5 truncate text-[10px] text-muted">
              {{ formattedDate(document.updatedAt) }}
            </p>
          </button>
        </div>

        <div
          v-else-if="filteredRecentFiles.length"
          class="overflow-hidden rounded-lg border border-border"
        >
          <button
            v-for="document in filteredRecentFiles"
            :key="document.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-hover sm:min-h-0 sm:px-4 sm:py-3"
            @click="openRecent(document)"
          >
            <icon-lucide-file-image class="size-4 shrink-0 text-accent" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium">{{ document.name }}</span>
              <span class="mt-0.5 block truncate text-[10px] text-muted sm:hidden">{{
                formattedDate(document.updatedAt)
              }}</span>
            </span>
            <span class="hidden shrink-0 text-[10px] text-muted sm:inline">{{
              formattedDate(document.updatedAt)
            }}</span>
          </button>
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
            <Tip :label="common.refresh">
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface sm:size-7"
                :aria-label="common.refresh"
                @click="storageWorkspace.refresh"
              >
                <icon-lucide-refresh-cw class="size-3.5" />
              </button>
            </Tip>
            <Tip :label="settings.title">
              <button
                type="button"
                class="flex size-10 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface sm:size-7"
                :aria-label="settings.title"
                @click="openSettingsDialog('storage')"
              >
                <icon-lucide-settings-2 class="size-3.5" />
              </button>
            </Tip>
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
          <button
            type="button"
            class="mt-3 rounded border border-border px-3 py-1.5 text-xs hover:bg-hover"
            @click="storageWorkspace.refresh"
          >
            {{ common.refresh }}
          </button>
        </div>

        <div
          v-else-if="filteredStorageDocuments.length && view === 'grid'"
          class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
        >
          <button
            v-for="document in filteredStorageDocuments"
            :key="document.id"
            type="button"
            class="group min-w-0 text-left"
            @click="openStorageDocument(document)"
          >
            <div
              v-storage-preview="document.id"
              class="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field transition-colors group-hover:border-panel-focus"
            >
              <img
                v-if="storagePreviewURL(document.id)"
                :src="storagePreviewURL(document.id) ?? undefined"
                alt=""
                class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
              />
              <icon-lucide-file-image v-else class="size-8 text-muted/40" />
            </div>
            <p class="mt-2 truncate text-xs font-medium">{{ document.name }}</p>
            <p class="mt-0.5 truncate text-[10px] text-muted">
              {{ formattedDate(document.updatedAt) }}
            </p>
          </button>
        </div>

        <div
          v-else-if="filteredStorageDocuments.length"
          class="overflow-hidden rounded-lg border border-border"
        >
          <button
            v-for="document in filteredStorageDocuments"
            :key="document.id"
            type="button"
            class="flex min-h-14 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-hover sm:min-h-0 sm:px-4 sm:py-3"
            @click="openStorageDocument(document)"
          >
            <icon-lucide-file-image class="size-4 shrink-0 text-accent" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-xs font-medium">{{ document.name }}</span>
              <span class="mt-0.5 block truncate text-[10px] text-muted sm:hidden">{{
                formattedDate(document.updatedAt)
              }}</span>
            </span>
            <span class="hidden shrink-0 text-[10px] text-muted sm:inline">{{
              formattedDate(document.updatedAt)
            }}</span>
          </button>
        </div>

        <div
          v-else-if="!storageConfigured"
          class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
        >
          <p>{{ storage.notConfigured }}</p>
          <button
            type="button"
            class="mt-3 rounded border border-border px-3 py-1.5 text-xs text-surface hover:bg-hover"
            @click="openSettingsDialog('storage')"
          >
            {{ settings.title }}
          </button>
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
