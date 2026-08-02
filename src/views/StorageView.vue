<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  storageThumbnailMimeType,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageDocument
} from '@/app/integrations/storage'
import { openSettingsDialog, settingsDialogOpen } from '@/app/settings/dialog'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import { createCanvasId } from '@/app/storage/id'
import { isDeckStorageFile, prepareDeckStorageImport } from '@/app/storage/import'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { enqueuePutThumb, persistStorageCanvasLocally } from '@/app/storage/sync'
import { createStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'
import { nextUniqueStorageName } from '@/app/storage/unique-name'
import { activeTab, createTab, openStorageDocumentInNewTab } from '@/app/tabs'

const { dialogs } = useI18n()
const router = useRouter()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const documents = ref<StorageDocument[]>([])
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const configured = computed(
  () =>
    storagePreferencesComplete(provider.value.id) &&
    provider.value.credentialFields.every(
      (field) => !field.required || credentialStatuses.value[field.id] === 'configured'
    )
)
const loading = ref(false)
const error = ref<string | null>(null)
const workspace = ref<HTMLElement | null>(null)
const dropActive = ref(false)
const importing = ref(false)
const thumbnailUrls = ref<Record<string, string>>({})
const ownedThumbnailUrls = new Map<string, string>()
let dragDepth = 0
let thumbnailLoadGeneration = 0

function setThumbnailUrl(documentId: string, bytes: Uint8Array): void {
  const previous = ownedThumbnailUrls.get(documentId)
  if (previous) URL.revokeObjectURL(previous)
  const next = URL.createObjectURL(new Blob([bytes], { type: storageThumbnailMimeType(bytes) }))
  ownedThumbnailUrls.set(documentId, next)
  thumbnailUrls.value = { ...thumbnailUrls.value, [documentId]: next }
}

function clearThumbnailUrls(): void {
  thumbnailLoadGeneration++
  for (const url of ownedThumbnailUrls.values()) URL.revokeObjectURL(url)
  ownedThumbnailUrls.clear()
  thumbnailUrls.value = {}
}

async function loadDocumentThumbnails(items: StorageDocument[]): Promise<void> {
  if (!configured.value || items.length === 0) return
  const generation = ++thumbnailLoadGeneration
  const providerId = activeStorageProviderID.value
  const adapter = createActiveStorageAdapter(providerId)
  const localStore = getLocalCanvasStore()
  const missing: StorageDocument[] = []

  // Prefer tiny cached/remote thumbnails before considering full document downloads.
  for (let offset = 0; offset < items.length; offset += 6) {
    const batch = items.slice(offset, offset + 6)
    const loaded = await Promise.all(
      batch.map(async (document) => {
        const local = await localStore.readThumb(document.id)
        if (isUsableStorageThumbnail(local)) return { document, bytes: local }
        const remote = adapter.getThumbnail
          ? await adapter.getThumbnail(document.id).catch(() => null)
          : null
        return { document, bytes: remote }
      })
    )
    if (generation !== thumbnailLoadGeneration) return
    for (const result of loaded) {
      if (isUsableStorageThumbnail(result.bytes)) {
        await localStore.writeThumb(result.document.id, result.bytes)
        setThumbnailUrl(result.document.id, result.bytes)
      } else {
        missing.push(result.document)
      }
    }
  }

  // Legacy cloud documents have no separate thumbnail object. Backfill them one at a time
  // from the thumbnail embedded in their native archive (or raster the first page).
  for (const document of missing) {
    if (generation !== thumbnailLoadGeneration) return
    try {
      const bytes = await adapter.getDocument(document.id)
      const thumbnail = await createStorageThumbnail(bytes, document.sourceFormat)
      if (!isUsableStorageThumbnail(thumbnail)) continue
      const metadata = await localStore.writeThumb(document.id, thumbnail)
      if (metadata) await enqueuePutThumb(document.id, metadata.revision)
      if (generation === thumbnailLoadGeneration) setThumbnailUrl(document.id, thumbnail)
    } catch (reason) {
      console.warn('[Storage] Thumbnail backfill failed:', document.id, reason)
    }
  }
}

async function paintLocalDocuments(): Promise<void> {
  const local = (await getLocalCanvasStore().listMetas()).filter(
    (metadata) => metadata.providerId === activeStorageProviderID.value
  )
  documents.value = local.map((metadata) => ({
    id: metadata.id,
    name: metadata.name,
    updatedAt: metadata.updatedAt,
    sourceFormat: metadata.sourceFormat,
    metadataAuthoritative: true
  }))
}

async function refresh(): Promise<void> {
  loading.value = true
  error.value = null
  await paintLocalDocuments()
  try {
    credentialStatuses.value = await storageCredentialStatuses(provider.value.id)
    if (!configured.value) {
      error.value = dialogs.value.storageNotConfigured
      return
    }
    const remote = await createActiveStorageAdapter().listDocuments()
    const localStore = getLocalCanvasStore()
    const local = (await localStore.listMetas(true)).filter(
      (metadata) => metadata.providerId === activeStorageProviderID.value
    )
    const reconciliation = reconcileStorageDocuments(local, remote)
    documents.value = reconciliation.documents

    for (const id of reconciliation.localIdsToPurge) await localStore.remove(id)
    for (const document of reconciliation.remoteDocumentsToSeed) {
      await localStore.upsertIndexMeta({
        id: document.id,
        providerId: activeStorageProviderID.value,
        name: document.name,
        sourceFormat: document.sourceFormat,
        updatedAt: document.updatedAt,
        syncStatus: 'synced',
        lastSyncedAt: document.updatedAt,
        lastSyncError: null
      })
    }
    void loadDocumentThumbnails(documents.value)
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

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

function eventHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(event: DragEvent): void {
  if (!eventHasFiles(event)) return
  event.preventDefault()
  dragDepth++
  dropActive.value = true
}

function onDragOver(event: DragEvent): void {
  if (!eventHasFiles(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = configured.value ? 'copy' : 'none'
}

function onDragLeave(event: DragEvent): void {
  if (!eventHasFiles(event)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dropActive.value = false
}

async function importDroppedDecks(files: File[]): Promise<void> {
  if (!configured.value || importing.value) return
  const deckFiles = files.filter((file) => isDeckStorageFile(file.name))
  if (deckFiles.length === 0) {
    error.value = dialogs.value.storageDeckFilesOnly
    return
  }

  importing.value = true
  error.value = null
  const providerId = activeStorageProviderID.value
  const takenNames = new Set(documents.value.map((document) => document.name))
  const failures: string[] = []
  try {
    for (const file of deckFiles) {
      try {
        const prepared = await prepareDeckStorageImport(file)
        const name = nextUniqueStorageName(prepared.name, takenNames)
        takenNames.add(name)
        const id = createCanvasId()
        const updatedAt = new Date().toISOString()
        await persistStorageCanvasLocally({
          providerId,
          canvasId: id,
          name,
          sourceFormat: prepared.sourceFormat,
          figBytes: prepared.bytes,
          thumbnailBytes: prepared.thumbnailBytes
        })
        const document: StorageDocument = {
          id,
          name,
          sourceFormat: prepared.sourceFormat,
          updatedAt,
          metadataAuthoritative: true
        }
        documents.value = [document, ...documents.value]
        if (isUsableStorageThumbnail(prepared.thumbnailBytes)) {
          setThumbnailUrl(id, prepared.thumbnailBytes)
        }
      } catch (reason) {
        failures.push(`${file.name}: ${reason instanceof Error ? reason.message : String(reason)}`)
      }
    }
  } finally {
    importing.value = false
  }
  if (failures.length) error.value = failures.join('\n')
}

function onDrop(event: DragEvent): void {
  if (!eventHasFiles(event)) return
  event.preventDefault()
  dragDepth = 0
  dropActive.value = false
  void importDroppedDecks(Array.from(event.dataTransfer?.files ?? []))
}

useEventListener(workspace, 'dragenter', onDragEnter)
useEventListener(workspace, 'dragover', onDragOver)
useEventListener(workspace, 'dragleave', onDragLeave)
useEventListener(workspace, 'drop', onDrop)

watch(activeStorageProviderID, () => {
  clearThumbnailUrls()
  void refresh()
})

watch(settingsDialogOpen, (open, wasOpen) => {
  if (wasOpen && !open) void refresh()
})

onMounted(() => {
  void refresh()
})

onBeforeUnmount(clearThumbnailUrls)
</script>

<template>
  <main
    ref="workspace"
    class="relative flex min-h-screen flex-col bg-app text-surface"
    data-test-id="storage-workspace"
    :aria-busy="importing"
  >
    <header class="flex h-14 items-center border-b border-border px-6">
      <div>
        <h1 class="text-sm font-semibold">{{ dialogs.storageWorkspace }}</h1>
        <p class="text-[10px] text-muted">{{ activeStorageProviderID }}</p>
      </div>
      <div class="ml-auto flex gap-2">
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
      <div class="mb-4 flex shrink-0 items-center justify-between">
        <p v-if="error && configured" class="whitespace-pre-line text-xs text-danger" role="alert">
          {{ error }}
        </p>
        <p v-else-if="importing" class="text-xs text-muted" role="status">
          {{ dialogs.importingDeckFiles }}
        </p>
        <span v-else />
        <button
          v-if="configured"
          type="button"
          class="rounded px-2 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
          @click="refresh"
        >
          {{ dialogs.refresh }}
        </button>
      </div>

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
            class="flex aspect-[4/3] items-center justify-center overflow-hidden bg-panel-field"
            data-slot="storage-thumbnail"
          >
            <img
              v-if="thumbnailUrls[document.id]"
              :src="thumbnailUrls[document.id]"
              alt=""
              class="size-full object-cover"
            />
            <icon-lucide-presentation v-else class="size-5 text-muted/50" />
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

    <div
      v-if="dropActive"
      class="pointer-events-none absolute inset-3 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-app/90"
      role="status"
    >
      <div class="flex flex-col items-center gap-2 text-accent">
        <icon-lucide-cloud-upload class="size-8" />
        <p class="text-sm font-medium">{{ dialogs.dropDeckFiles }}</p>
      </div>
    </div>
  </main>
</template>
