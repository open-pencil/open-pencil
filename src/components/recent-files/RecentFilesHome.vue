<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'

import { useDocumentWorkspace, useI18n } from '@open-pencil/vue'

import {
  clearRecentFiles,
  forgetRecentFile,
  loadRecentFileThumbnail,
  recentFiles,
  type RecentLocalDocument
} from '@/app/recent-files'
import { openFileDialog, openFileFromPath } from '@/app/shell/menu/use'
import { activeStorageProviderID, type StorageDocument } from '@/app/integrations/storage'
import { openSettingsDialog } from '@/app/settings/dialog'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import { openStorageDocumentInNewTab } from '@/app/tabs'

const emit = defineEmits<{ 'new-document': [] }>()
const { dialogs, menu, panels, locale } = useI18n()
const view = useLocalStorage<'grid' | 'list'>('open-pencil:home-files-view', 'grid')
const openError = ref<string | null>(null)
const storageConfigured = ref(false)

const workspace = useDocumentWorkspace<RecentLocalDocument>({
  source: {
    async refresh() {
      return recentFiles.value.filter(
        (document): document is RecentLocalDocument => document.kind === 'local'
      )
    },
    loadPreview(documentId) {
      const document = recentFiles.value.find(
        (candidate) => candidate.id === documentId && candidate.kind === 'local'
      )
      return document?.kind === 'local'
        ? loadRecentFileThumbnail(document.path)
        : Promise.resolve(null)
    }
  },
  refreshOnFocus: false,
  refreshOnReconnect: false,
  previewConcurrency: 2
})

const documents = workspace.documents
const previewURL = workspace.previewURL
const vWorkspacePreview = workspace.previewDirective
const hasRecentFiles = computed(() => documents.value.length > 0)

const storageWorkspace = useDocumentWorkspace<StorageDocument>({
  source: createStorageWorkspaceSource((snapshot) => {
    storageConfigured.value = snapshot.configured
  }),
  refreshInterval: 60_000,
  previewConcurrency: 6
})
const storageDocuments = storageWorkspace.documents
const storagePreviewURL = storageWorkspace.previewURL
const vStoragePreview = storageWorkspace.previewDirective

watch(recentFiles, () => void workspace.invalidate())

async function refreshHome(): Promise<void> {
  await Promise.all([workspace.refresh(), storageWorkspace.refresh()])
}

async function openRecent(document: RecentLocalDocument): Promise<void> {
  openError.value = null
  try {
    await openFileFromPath(document.path)
  } catch (error) {
    forgetRecentFile(document.path)
    openError.value = error instanceof Error ? error.message : String(error)
  }
}

async function openStorageDocument(document: StorageDocument): Promise<void> {
  await openStorageDocumentInNewTab(document)
}

function formattedDate(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (date.getTime() === 0) return ''
  return date.toLocaleString(locale.value)
}
</script>

<template>
  <main class="flex min-h-0 flex-1 flex-col bg-app text-surface" data-test-id="recent-files-home">
    <header class="flex h-14 shrink-0 items-center border-b border-border px-6">
      <div class="flex items-center gap-2.5">
        <img src="/favicon-32.png" class="size-5" alt="" />
        <span class="text-sm font-semibold">OpenPencil</span>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="flex size-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
          :aria-label="dialogs.refresh"
          @click="refreshHome"
        >
          <icon-lucide-refresh-cw class="size-3.5" />
        </button>
        <button
          type="button"
          class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          @click="openSettingsDialog('storage')"
        >
          <icon-lucide-settings-2 class="mr-1.5 inline size-3.5" />
          {{ dialogs.settings }}
        </button>
        <button
          type="button"
          class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          data-test-id="home-open-file"
          @click="openFileDialog"
        >
          <icon-lucide-folder-open class="mr-1.5 inline size-3.5" />
          {{ menu.open }}
        </button>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          data-test-id="home-new-document"
          @click="emit('new-document')"
        >
          <icon-lucide-plus class="mr-1 inline size-3.5" />
          {{ menu.new }}
        </button>
      </div>
    </header>

    <section class="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-8 py-10">
      <div class="mb-6 flex items-center">
        <div>
          <h1 class="text-xl font-semibold">{{ dialogs.recentFiles }}</h1>
          <p class="mt-1 text-xs text-muted">{{ dialogs.recentFilesDescription }}</p>
        </div>
        <div class="ml-auto flex rounded border border-border p-0.5">
          <button
            v-if="hasRecentFiles"
            type="button"
            class="flex size-7 items-center justify-center rounded-sm text-muted hover:text-surface"
            :aria-label="dialogs.clear"
            data-test-id="recent-files-clear"
            @click="clearRecentFiles"
          >
            <icon-lucide-trash-2 class="size-3.5" />
          </button>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-sm text-muted hover:text-surface"
            :class="{ 'bg-hover text-surface': view === 'grid' }"
            :aria-label="panels.gridView"
            @click="view = 'grid'"
          >
            <icon-lucide-layout-grid class="size-3.5" />
          </button>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-sm text-muted hover:text-surface"
            :class="{ 'bg-hover text-surface': view === 'list' }"
            :aria-label="panels.listView"
            @click="view = 'list'"
          >
            <icon-lucide-list class="size-3.5" />
          </button>
        </div>
      </div>

      <p v-if="openError" class="mb-4 text-xs text-danger" role="alert">{{ openError }}</p>

      <div
        v-if="hasRecentFiles && view === 'grid'"
        class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5"
        data-test-id="recent-files-grid"
      >
        <button
          v-for="document in documents"
          :key="document.path"
          type="button"
          class="group overflow-hidden rounded-lg border border-border bg-panel text-left transition-colors hover:border-panel-focus hover:bg-hover"
          @click="openRecent(document)"
        >
          <div
            v-workspace-preview="document.path"
            class="flex aspect-video items-center justify-center overflow-hidden bg-panel-field"
          >
            <img
              v-if="previewURL(document.path)"
              :src="previewURL(document.path) ?? undefined"
              alt=""
              class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
            />
            <icon-lucide-file-image v-else class="size-8 text-muted/40" />
          </div>
          <div class="border-t border-border p-3">
            <p class="truncate text-xs font-medium">{{ document.name }}</p>
            <p class="mt-1 truncate text-[10px] text-muted">
              {{ formattedDate(document.updatedAt) }}
            </p>
          </div>
        </button>
      </div>

      <div
        v-else-if="hasRecentFiles"
        class="overflow-hidden rounded-lg border border-border"
        data-test-id="recent-files-list"
      >
        <button
          v-for="document in documents"
          :key="document.path"
          type="button"
          class="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-hover"
          @click="openRecent(document)"
        >
          <icon-lucide-file-image class="size-4 shrink-0 text-accent" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium">{{ document.name }}</span>
          <span class="shrink-0 text-[10px] text-muted">{{
            formattedDate(document.updatedAt)
          }}</span>
        </button>
      </div>

      <div
        v-else-if="!storageConfigured"
        class="flex flex-1 flex-col items-center justify-center pb-20 text-center"
      >
        <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-panel-field">
          <icon-lucide-files class="size-5 text-muted" />
        </div>
        <p class="text-sm font-medium">{{ dialogs.noRecentFiles }}</p>
        <p class="mt-1 max-w-sm text-xs text-muted">{{ dialogs.noRecentFilesDescription }}</p>
        <button
          type="button"
          class="mt-5 rounded border border-border px-3 py-1.5 text-xs hover:bg-hover"
          @click="openFileDialog"
        >
          {{ menu.open }}
        </button>
      </div>

      <section v-if="storageConfigured" class="mt-10">
        <div class="mb-6 flex items-center">
          <div>
            <h2 class="text-xl font-semibold">{{ dialogs.storageWorkspace }}</h2>
            <p class="mt-1 text-xs text-muted">{{ activeStorageProviderID }}</p>
          </div>
        </div>
        <div
          v-if="storageDocuments.length && view === 'grid'"
          class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5"
        >
          <button
            v-for="document in storageDocuments"
            :key="document.id"
            type="button"
            class="group overflow-hidden rounded-lg border border-border bg-panel text-left transition-colors hover:border-panel-focus hover:bg-hover"
            @click="openStorageDocument(document)"
          >
            <div
              v-storage-preview="document.id"
              class="flex aspect-video items-center justify-center overflow-hidden bg-panel-field"
            >
              <img
                v-if="storagePreviewURL(document.id)"
                :src="storagePreviewURL(document.id) ?? undefined"
                alt=""
                class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015]"
              />
              <icon-lucide-file-image v-else class="size-8 text-muted/40" />
            </div>
            <div class="border-t border-border p-3">
              <p class="truncate text-xs font-medium">{{ document.name }}</p>
              <p class="mt-1 truncate text-[10px] text-muted">
                {{ formattedDate(document.updatedAt) }}
              </p>
            </div>
          </button>
        </div>
        <div
          v-else-if="storageDocuments.length"
          class="overflow-hidden rounded-lg border border-border"
        >
          <button
            v-for="document in storageDocuments"
            :key="document.id"
            type="button"
            class="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-hover"
            @click="openStorageDocument(document)"
          >
            <icon-lucide-file-image class="size-4 shrink-0 text-accent" />
            <span class="min-w-0 flex-1 truncate text-xs font-medium">{{ document.name }}</span>
            <span class="shrink-0 text-[10px] text-muted">{{
              formattedDate(document.updatedAt)
            }}</span>
          </button>
        </div>
        <div
          v-else
          class="rounded-lg border border-border border-dashed px-4 py-8 text-center text-xs text-muted"
        >
          {{ dialogs.emptyStorageWorkspace }}
        </div>
      </section>
    </section>
  </main>
</template>
