<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDocumentWorkspace, useI18n } from '@open-pencil/vue'

import { activeStorageProviderID, type StorageDocument } from '@/app/integrations/storage'
import { openSettingsDialog, settingsDialogOpen } from '@/app/settings/dialog'
import { createCanvasId } from '@/app/storage/id'
import { createStorageWorkspaceSource } from '@/app/storage/workspace/source'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import Tip from '@/components/ui/Tip.vue'
import { activeTab, createTab, openStorageDocumentInNewTab } from '@/app/tabs'

const { dialogs } = useI18n()
const router = useRouter()
const configured = ref(false)
const workspace = useDocumentWorkspace({
  source: createStorageWorkspaceSource((snapshot) => {
    configured.value = snapshot.configured
  }),
  refreshInterval: 60_000,
  previewConcurrency: 6
})
const documents = workspace.documents
const loading = workspace.loading
const errorMessage = computed(() => {
  const reason = workspace.error.value
  if (reason == null) return null
  return reason instanceof Error ? reason.message : String(reason)
})
const refresh = workspace.refresh
const invalidate = workspace.invalidate
const clearPreviews = workspace.clearPreviews
const previewURL = workspace.previewURL
const vWorkspacePreview = workspace.previewDirective

async function openDocument(document: StorageDocument): Promise<void> {
  await router.push('/')
  await nextTick()
  await openStorageDocumentInNewTab(document)
}

async function createDocument(): Promise<void> {
  if (!configured.value) return
  await router.push('/')
  await nextTick()
  const current = activeTab.value
  const store =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
      ? current.store
      : createTab().store
  const documentId = createCanvasId()
  store.setStorageDocumentSource(
    { providerId: activeStorageProviderID.value, documentId },
    'Untitled'
  )
  await store.saveFigFile()
}

watch(activeStorageProviderID, () => {
  clearPreviews()
  void invalidate()
})

watch(settingsDialogOpen, (open, wasOpen) => {
  if (wasOpen && !open) void invalidate()
})
</script>

<template>
  <main class="flex min-h-screen flex-col bg-app text-surface" data-test-id="storage-workspace">
    <header class="flex h-14 items-center border-b border-border px-6">
      <div>
        <h1 class="text-sm font-semibold">{{ dialogs.storageWorkspace }}</h1>
        <p class="text-[10px] text-muted">{{ activeStorageProviderID }}</p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <Tip v-if="configured" :label="dialogs.refresh">
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface disabled:opacity-50"
            :aria-label="dialogs.refresh"
            :disabled="loading"
            @click="refresh"
          >
            <icon-lucide-refresh-cw class="size-3.5" :class="{ 'animate-spin': loading }" />
          </button>
        </Tip>
        <button
          type="button"
          class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          @click="openSettingsDialog('storage')"
        >
          {{ dialogs.settings }}
        </button>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!configured"
          data-test-id="storage-new-document"
          @click="createDocument"
        >
          {{ dialogs.newStoredDocument }}
        </button>
      </div>
    </header>

    <section class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col p-6">
      <p v-if="errorMessage && configured" class="mb-4 shrink-0 text-xs text-danger" role="alert">
        {{ errorMessage }}
      </p>

      <div
        v-if="documents.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4"
      >
        <button
          v-for="document in documents"
          :key="document.id"
          type="button"
          class="group overflow-hidden rounded-lg border border-border bg-panel text-left hover:border-panel-focus hover:bg-hover"
          :data-document-id="document.id"
          @click="openDocument(document)"
        >
          <div
            v-workspace-preview="document.id"
            class="flex aspect-[4/3] items-center justify-center bg-panel-field"
          >
            <img
              v-if="previewURL(document.id)"
              :src="previewURL(document.id) ?? undefined"
              alt=""
              class="size-full object-cover"
            />
            <icon-lucide-file-image v-else class="size-6 text-muted/50" />
          </div>
          <div class="border-t border-border p-3">
            <p class="truncate text-xs font-medium">{{ document.name }}</p>
            <p class="mt-1 text-[10px] text-muted">
              {{ new Date(document.updatedAt).toLocaleString() }}
            </p>
          </div>
        </button>
      </div>

      <AppPlaceholder v-else-if="loading" :label="dialogs.loadingDocuments" size="page">
        <template #icon>
          <icon-lucide-loader-circle class="size-5 animate-spin" />
        </template>
      </AppPlaceholder>

      <AppPlaceholder v-else-if="configured" :label="dialogs.emptyStorageWorkspace" size="page">
        <template #icon>
          <icon-lucide-files class="size-5" />
        </template>
      </AppPlaceholder>

      <AppPlaceholder v-else :label="dialogs.storageNotConfigured" size="page">
        <template #icon>
          <icon-lucide-cloud class="size-5" />
        </template>
        <template #action>
          <button
            type="button"
            class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            @click="openSettingsDialog('storage')"
          >
            {{ dialogs.settings }}
          </button>
        </template>
      </AppPlaceholder>
    </section>
  </main>
</template>
