<script setup lang="ts">
import { useClipboard, useEventListener, useOnline } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
  DialogClose
} from 'reka-ui'
import { useI18n } from '@open-pencil/vue'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  readStoragePreferences,
  storageThumbnailMimeType,
  storageCredentialStatuses,
  nonSecretProviderContext,
  storagePreferencesComplete,
  storageProviderRegistry,
  type StorageDocument
} from '@/app/integrations/storage'
import { openSettingsDialog, settingsDialogOpen } from '@/app/settings/dialog'
import type { CredentialStatus } from '@/app/settings/credentials/types'
import {
  duplicateStorageDocument,
  moveStorageDocumentToTrash,
  permanentlyDeleteStorageDocument,
  renameStorageDocument,
  restoreStorageDocument
} from '@/app/storage/documents'
import { storageCredentialsSatisfied } from '@/app/storage/configured'
import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import { useDocumentSyncErrors } from '@/app/storage/document-sync-errors'
import { createCanvasId } from '@/app/storage/id'
import { isDeckStorageFile, prepareDeckStorageImport } from '@/app/storage/import'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { sortStorageDocuments, type StorageSortMode } from '@/app/storage/sort'
import { currentTargetIdFor } from '@/app/storage/target'
import {
  categorizeSyncFailure,
  clearSyncFailure,
  enqueuePutCanvas,
  enqueuePutThumb,
  lastSyncFailure,
  persistStorageCanvasLocally,
  recordSyncFailure,
  setSyncUi,
  syncUiState
} from '@/app/storage/sync'
import { createStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'
import { nextUniqueStorageName } from '@/app/storage/unique-name'
import { activeTab, createDeckTab, createTab, openStorageDocumentInNewTab } from '@/app/tabs'
import StorageDocumentCard from '@/components/storage/StorageDocumentCard.vue'
import RefreshIcon from '@/components/storage/RefreshIcon.vue'
import TrashIcon from '@/components/storage/TrashIcon.vue'
import CloudWorkspaceStatus from '@/components/storage/CloudWorkspaceStatus.vue'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import {
  AppAlertDialogRoot,
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const { dialogs } = useI18n()
const router = useRouter()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))
const documents = ref<StorageDocument[]>([])
const credentialStatuses = ref<Record<string, CredentialStatus>>({})
const configured = computed(
  () =>
    storagePreferencesComplete(provider.value.id) &&
    storageCredentialsSatisfied(provider.value.id, credentialStatuses.value)
)
const loading = ref(false)
const browserOnline = useOnline()
const error = ref<string | null>(null)
const workspace = ref<HTMLElement | null>(null)
const dropActive = ref(false)
const importing = ref(false)
const folder = ref<'documents' | 'trash'>('documents')
const sortMode = ref<StorageSortMode>('date-desc')
const busyDocumentIds = ref<Set<string>>(new Set())
const renameOpen = ref(false)
const renameTarget = ref<StorageDocument | null>(null)
const renameValue = ref('')
const deleteOpen = ref(false)
const deleteTarget = ref<StorageDocument | null>(null)
const deletePermanently = ref(false)
const thumbnailUrls = ref<Record<string, string>>({})
const { errors: documentSyncErrors, setFrom: setDocumentSyncErrors } = useDocumentSyncErrors(
  () => activeStorageProviderID.value
)
const ownedThumbnailUrls = new Map<string, string>()
const queuedThumbnailIds = new Set<string>()
const activeThumbnailIds = new Set<string>()
const thumbnailQueue: StorageDocument[] = []
/**
 * Documents whose full body was already fetched to recover a thumbnail.
 *
 * A legacy document that yields no usable thumbnail produced no record of the
 * attempt, so every scroll past its card downloaded the whole document again.
 * One attempt per document per session, whatever the outcome.
 */
const thumbnailBackfillAttempted = new Set<string>()
const maxConcurrentThumbnailLoads = 3
let dragDepth = 0
let thumbnailLoadGeneration = 0

const visibleDocuments = computed(() =>
  sortStorageDocuments(
    documents.value.filter((document) =>
      folder.value === 'trash' ? document.trashedAt !== null : document.trashedAt === null
    ),
    sortMode.value
  )
)
const trashedDocumentCount = computed(
  () => documents.value.filter((document) => document.trashedAt !== null).length
)
const sortOptions = computed(() => [
  { value: 'name-asc' as const, label: dialogs.value.storageSortNameAsc },
  { value: 'name-desc' as const, label: dialogs.value.storageSortNameDesc },
  { value: 'date-desc' as const, label: dialogs.value.storageSortNewest },
  { value: 'date-asc' as const, label: dialogs.value.storageSortOldest }
])
const deleteDialogDescription = computed(() => {
  const target = deleteTarget.value
  if (!target) return ''
  const params = { name: target.name }
  return deletePermanently.value
    ? dialogs.value.storageDeletePermanentlyDescription(params)
    : dialogs.value.storageMoveToTrashDescription(params)
})

function setThumbnailUrl(documentId: string, bytes: Uint8Array): void {
  const previous = ownedThumbnailUrls.get(documentId)
  if (previous) URL.revokeObjectURL(previous)
  const next = URL.createObjectURL(new Blob([bytes], { type: storageThumbnailMimeType(bytes) }))
  ownedThumbnailUrls.set(documentId, next)
  thumbnailUrls.value = { ...thumbnailUrls.value, [documentId]: next }
}

function clearThumbnailUrls(): void {
  thumbnailLoadGeneration++
  thumbnailQueue.length = 0
  queuedThumbnailIds.clear()
  thumbnailBackfillAttempted.clear()
  for (const url of ownedThumbnailUrls.values()) URL.revokeObjectURL(url)
  ownedThumbnailUrls.clear()
  thumbnailUrls.value = {}
}

async function loadDocumentThumbnail(document: StorageDocument, generation: number): Promise<void> {
  // Pin the provider before the first await. Reading it afterwards would fetch
  // one provider's preview under another provider's credentials, and the write
  // below would cache the result against the wrong document set.
  const providerId = activeStorageProviderID.value
  const localStore = getLocalCanvasStore()
  const local = await localStore.readThumb(document.id)
  if (generation !== thumbnailLoadGeneration) return
  if (isUsableStorageThumbnail(local)) {
    setThumbnailUrl(document.id, local)
    return
  }

  const adapter = createActiveStorageAdapter(providerId)
  const remote = adapter.getThumbnail
    ? await adapter.getThumbnail(document.id).catch(() => null)
    : null
  if (generation !== thumbnailLoadGeneration) return
  if (isUsableStorageThumbnail(remote)) {
    await localStore.writeThumb(document.id, remote)
    if (generation === thumbnailLoadGeneration) setThumbnailUrl(document.id, remote)
    return
  }

  // Legacy documents may only contain an archive thumbnail. Backfill it once,
  // cache it locally, and upload the small object so later devices do not need
  // the full document.
  //
  // Documents saved by this build embed a real thumbnail at export, so this
  // path is unreachable for them. It remains only for archives written before
  // that fix, and is bounded to one attempt each: the download is the whole
  // document, and repeating it per render is how a 200-document bucket cost
  // 200 full downloads to draw a grid.
  if (thumbnailBackfillAttempted.has(document.id)) return
  thumbnailBackfillAttempted.add(document.id)
  const bytes = await adapter.getDocument(document.id)
  const thumbnail = await createStorageThumbnail(bytes, document.sourceFormat)
  if (!isUsableStorageThumbnail(thumbnail) || generation !== thumbnailLoadGeneration) return
  const metadata = await localStore.writeThumb(document.id, thumbnail)
  if (metadata) await enqueuePutThumb(document.id, metadata.revision)
  if (generation === thumbnailLoadGeneration) setThumbnailUrl(document.id, thumbnail)
}

function pumpThumbnailQueue(): void {
  while (activeThumbnailIds.size < maxConcurrentThumbnailLoads && thumbnailQueue.length > 0) {
    const document = thumbnailQueue.shift()
    if (!document) return
    queuedThumbnailIds.delete(document.id)
    activeThumbnailIds.add(document.id)
    const generation = thumbnailLoadGeneration
    void loadDocumentThumbnail(document, generation)
      .catch((reason) => {
        console.warn('[Storage] Thumbnail load failed:', document.id, reason)
      })
      .finally(() => {
        activeThumbnailIds.delete(document.id)
        pumpThumbnailQueue()
      })
  }
}

function requestDocumentThumbnail(document: StorageDocument): void {
  if (
    thumbnailUrls.value[document.id] ||
    queuedThumbnailIds.has(document.id) ||
    activeThumbnailIds.has(document.id)
  ) {
    return
  }
  queuedThumbnailIds.add(document.id)
  thumbnailQueue.push(document)
  pumpThumbnailQueue()
}

/**
 * Refresh generation guard.
 *
 * `refresh()` is triggered by mount, the provider watcher, and the settings
 * dialog closing, so several can be in flight at once. Without a guard, a slow
 * listing from the PREVIOUS provider resolves last and wins — painting one
 * provider's documents under another provider's name, and (far worse) seeding
 * them into the local store tagged with whatever provider is active by the time
 * the write runs, which corrupts the row permanently.
 */
let refreshGeneration = 0

function isCurrentRefresh(generation: number, providerId: string): boolean {
  return generation === refreshGeneration && providerId === activeStorageProviderID.value
}

async function paintLocalDocuments(generation: number, providerId: string): Promise<void> {
  // Resolve the destination before the listing, not inside the filter it feeds:
  // the bucket can be edited while this is in flight, and a target resolved
  // afterwards would silently paint a different bucket's document set.
  const targetId = currentTargetIdFor(providerId)
  const local = (await getLocalCanvasStore().listMetas()).filter(
    (metadata) => metadata.syncTargetId === targetId
  )
  if (!isCurrentRefresh(generation, providerId)) return
  documents.value = local.map((metadata) => ({
    id: metadata.id,
    name: metadata.name,
    updatedAt: metadata.updatedAt,
    sourceFormat: metadata.sourceFormat,
    trashedAt: metadata.trashedAt,
    metadataAuthoritative: true
  }))
  setDocumentSyncErrors(local)
}

const { copy, copied: errorCopied } = useClipboard()

/**
 * Copy the failure with the context a bug report needs — a bare message like
 * `User (role: guests) missing scopes` says nothing about which provider or
 * endpoint produced it.
 *
 * Preference fields only: credentials live in the credential store and are
 * never read here, so nothing secret can reach the clipboard.
 */
function copyError(): void {
  const preferences = readStoragePreferences(provider.value.id)
  const details = [
    'OpenPencil storage error',
    `Provider: ${provider.value.label} (${provider.value.id})`,
    ...Object.entries(preferences)
      .filter(([, value]) => value)
      .map(([field, value]) => `${field}: ${value}`),
    `Online: ${browserOnline.value}`,
    `Time: ${new Date().toISOString()}`,
    '',
    error.value ?? ''
  ]
  void copy(details.join('\n'))
}

async function refresh(): Promise<void> {
  // Pin the provider for the whole pass. Reading the live ref after an await
  // would attribute this listing to whichever provider is active by then.
  const providerId = activeStorageProviderID.value
  // Pin the DESTINATION too, not just the provider. `isCurrentRefresh` compares
  // provider ids only, so editing the bucket mid-listing passes that guard while
  // silently retagging every row this pass seeds.
  const targetId = currentTargetIdFor(providerId)
  const generation = ++refreshGeneration
  loading.value = true
  error.value = null
  await paintLocalDocuments(generation, providerId)
  try {
    const statuses = await storageCredentialStatuses(providerId)
    if (!isCurrentRefresh(generation, providerId)) return
    credentialStatuses.value = statuses
    if (!configured.value) {
      // Not an error: local documents are already painted and fully usable.
      // Reporting this as a failure is what made first run look broken.
      return
    }
    const remote = await createActiveStorageAdapter(providerId).listDocuments()
    if (!isCurrentRefresh(generation, providerId)) return
    const localStore = getLocalCanvasStore()
    const local = (await localStore.listMetas(true)).filter(
      (metadata) => metadata.syncTargetId === targetId
    )
    if (!isCurrentRefresh(generation, providerId)) return
    // Listing works again. Clear only OUR failure — an outbox failure is the
    // engine's to own and clearing it here would hide real unsent work.
    if (lastSyncFailure.value?.operation === 'listDocuments') {
      clearSyncFailure()
      if (syncUiState.value === 'error') setSyncUi('idle')
    }
    const reconciliation = reconcileStorageDocuments(local, remote)
    documents.value = reconciliation.documents
    setDocumentSyncErrors(local)

    for (const id of reconciliation.localIdsToPurge) await localStore.remove(id)
    // Self-healing migration for rows written before body-upload tracking: the
    // remote listing enumerates fig keys, so appearing in it proves the body is
    // there. Restores evictability without trusting the old `synced` flag.
    // Legacy rows carry bytes nothing has identified. Re-upload rather than
    // assume: the listing proves a body exists remotely, not that it matches
    // what is on disk here, and eviction acts on that difference.
    for (const id of reconciliation.bodyUnconfirmedIds) {
      const metadata = local.find((row) => row.id === id)
      if (metadata) await enqueuePutCanvas(id, metadata.revision)
    }
    for (const document of reconciliation.remoteDocumentsToSeed) {
      await localStore.upsertIndexMeta({
        id: document.id,
        // The destination this listing actually came from — never the live ref.
        syncTargetId: targetId,
        name: document.name,
        sourceFormat: document.sourceFormat,
        trashedAt: document.trashedAt,
        updatedAt: document.updatedAt,
        syncStatus: 'synced',
        lastSyncedAt: document.updatedAt,
        lastSyncError: null
      })
    }
  } catch (reason) {
    if (!isCurrentRefresh(generation, providerId)) return
    error.value = reason instanceof Error ? reason.message : String(reason)
    // A listing failure is a sync failure. Reporting it only in the banner left
    // the chip showing a calm "Synced" beside it whenever the outbox happened
    // to be empty — the queue was drained, but the bucket was unreachable.
    recordSyncFailure({
      operation: 'listDocuments',
      providerId,
      providerContext: nonSecretProviderContext(providerId),
      documentIds: [],
      documentName: null,
      occurredAt: new Date().toISOString(),
      attempts: 1,
      category: categorizeSyncFailure(reason, browserOnline.value),
      rawError: error.value,
      status: null
    })
    setSyncUi('error', error.value)
  } finally {
    if (generation === refreshGeneration) loading.value = false
  }
}

async function openDocument(document: StorageDocument): Promise<void> {
  await router.push('/')
  await nextTick()
  await openStorageDocumentInNewTab(document)
}

function setDocumentBusy(documentId: string, busy: boolean): void {
  const next = new Set(busyDocumentIds.value)
  if (busy) next.add(documentId)
  else next.delete(documentId)
  busyDocumentIds.value = next
}

function replaceDocument(next: StorageDocument): void {
  documents.value = documents.value.map((document) => (document.id === next.id ? next : document))
}

function removeThumbnailUrl(documentId: string): void {
  const owned = ownedThumbnailUrls.get(documentId)
  if (owned) URL.revokeObjectURL(owned)
  ownedThumbnailUrls.delete(documentId)
  thumbnailUrls.value = Object.fromEntries(
    Object.entries(thumbnailUrls.value).filter(([id]) => id !== documentId)
  )
}

function startRename(document: StorageDocument): void {
  renameTarget.value = document
  renameValue.value = document.name
  renameOpen.value = true
}

async function commitRename(): Promise<void> {
  const target = renameTarget.value
  if (!target) return
  const name = nextUniqueStorageName(
    renameValue.value,
    documents.value.filter((document) => document.id !== target.id).map((document) => document.name)
  )
  if (name === target.name) {
    renameOpen.value = false
    return
  }
  setDocumentBusy(target.id, true)
  error.value = null
  try {
    replaceDocument(await renameStorageDocument(activeStorageProviderID.value, target, name))
    renameOpen.value = false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    setDocumentBusy(target.id, false)
  }
}

async function duplicateDocument(document: StorageDocument): Promise<void> {
  setDocumentBusy(document.id, true)
  error.value = null
  try {
    const name = nextUniqueStorageName(
      `${document.name} copy`,
      documents.value.map((item) => item.name)
    )
    const duplicated = await duplicateStorageDocument(activeStorageProviderID.value, document, name)
    documents.value = [duplicated.document, ...documents.value]
    if (isUsableStorageThumbnail(duplicated.thumbnailBytes)) {
      setThumbnailUrl(duplicated.document.id, duplicated.thumbnailBytes)
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    setDocumentBusy(document.id, false)
  }
}

function requestDelete(document: StorageDocument, permanent: boolean): void {
  deleteTarget.value = document
  deletePermanently.value = permanent
  deleteOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value
  if (!target) return
  const providerId = activeStorageProviderID.value
  setDocumentBusy(target.id, true)
  error.value = null
  try {
    if (deletePermanently.value) {
      await permanentlyDeleteStorageDocument(providerId, target)
      documents.value = documents.value.filter((document) => document.id !== target.id)
      removeThumbnailUrl(target.id)
    } else {
      replaceDocument(await moveStorageDocumentToTrash(providerId, target))
    }
    deleteOpen.value = false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    setDocumentBusy(target.id, false)
  }
}

async function restoreDocument(document: StorageDocument): Promise<void> {
  setDocumentBusy(document.id, true)
  error.value = null
  try {
    replaceDocument(await restoreStorageDocument(activeStorageProviderID.value, document))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    setDocumentBusy(document.id, false)
  }
}

async function createDocument(sourceFormat: 'fig' | 'deck'): Promise<void> {
  if (!configured.value) return
  // Bind the new document to the provider that was selected when the user asked
  // for it, not to whatever a route change and a tick later happens to be live.
  const providerId = activeStorageProviderID.value
  await router.push('/')
  await nextTick()
  const store =
    sourceFormat === 'deck'
      ? (await createDeckTab()).store
      : (() => {
          const current = activeTab.value
          // Only recycle a genuinely blank scratch tab. `!canUndo` means "not
          // edited in this session", NOT "empty": a stored document opened and
          // left untouched also has no undo history, so a document named
          // "Untitled" was being adopted wholesale — its contents were then
          // saved into the new document under a fresh id.
          const reusable =
            current?.store.state.documentKind === 'design' &&
            current.store.state.documentName === 'Untitled' &&
            !current.store.undo.canUndo &&
            current.store.getStorageBinding() === null
          return reusable ? current.store : createTab().store
        })()
  const documentId = createCanvasId()
  store.setStorageDocumentSource({ providerId, documentId }, 'Untitled', sourceFormat)
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
  // One destination for the whole batch. Resolving it per file would let a
  // bucket edit mid-import scatter one drop across two buckets.
  const targetId = currentTargetIdFor(providerId)
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
          syncTargetId: targetId,
          canvasId: id,
          name,
          sourceFormat: prepared.sourceFormat,
          updatedAt,
          trashedAt: null,
          figBytes: prepared.bytes,
          thumbnailBytes: prepared.thumbnailBytes
        })
        const document: StorageDocument = {
          id,
          name,
          sourceFormat: prepared.sourceFormat,
          trashedAt: null,
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
    class="relative flex h-screen min-h-0 flex-col overflow-hidden bg-app text-surface"
    data-test-id="storage-workspace"
    :aria-busy="importing"
  >
    <header class="flex h-14 items-center border-b border-border px-6">
      <div>
        <h1 class="text-sm font-semibold">{{ dialogs.storageWorkspace }}</h1>
        <p class="text-[10px] text-muted">{{ provider.label }}</p>
      </div>
      <div class="ml-auto flex gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          @click="openSettingsDialog('storage')"
        >
          <icon-lucide-settings class="size-3.5" />
          {{ dialogs.settings }}
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded border border-border bg-panel px-2.5 py-1.5 text-xs font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-test-id="storage-new-design"
          @click="createDocument('fig')"
        >
          <img :src="storageDocumentIconUrls.fig" alt="" class="size-4 rounded-[3px]" />
          {{ dialogs.newStoredDesign }}
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded border border-border bg-panel px-2.5 py-1.5 text-xs font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          data-test-id="storage-new-slides"
          @click="createDocument('deck')"
        >
          <img :src="storageDocumentIconUrls.deck" alt="" class="size-4 rounded-[3px]" />
          {{ dialogs.newStoredSlides }}
        </button>
      </div>
    </header>

    <section class="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-6">
      <div class="mb-4 flex shrink-0 items-center gap-2">
        <div class="flex rounded-md border border-border bg-panel p-0.5">
          <button
            type="button"
            class="rounded px-2.5 py-1 text-xs"
            :class="
              folder === 'documents' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'
            "
            data-test-id="storage-folder-documents"
            @click="folder = 'documents'"
          >
            {{ dialogs.storageDocuments }}
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs"
            :class="folder === 'trash' ? 'bg-hover text-surface' : 'text-muted hover:text-surface'"
            data-test-id="storage-folder-trash"
            @click="folder = 'trash'"
          >
            <TrashIcon class="size-3" />
            {{ dialogs.storageTrash }}
            <span v-if="trashedDocumentCount" class="text-[10px] text-muted">
              {{ trashedDocumentCount }}
            </span>
          </button>
        </div>
        <div class="ml-auto flex items-center gap-1.5">
          <AppSelect
            v-model="sortMode"
            :options="sortOptions"
            :label="dialogs.storageSort"
            class="min-w-40"
          />
          <button
            v-if="configured"
            type="button"
            class="flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs text-muted hover:bg-hover hover:text-surface"
            :aria-label="dialogs.refresh"
            :title="dialogs.refresh"
            @click="refresh"
          >
            <RefreshIcon class="size-3.5" :class="loading && 'animate-spin'" />
            <span>{{ dialogs.refresh }}</span>
          </button>
        </div>
      </div>

      <div class="mb-4 flex min-h-5 shrink-0 items-start gap-2">
        <template v-if="error && configured">
          <p
            class="flex-1 whitespace-pre-line text-xs text-danger select-text"
            data-test-id="storage-error"
            role="alert"
          >
            {{ error }}
          </p>
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-hover hover:text-surface"
            data-test-id="storage-error-copy"
            :aria-label="dialogs.copyStorageError"
            :title="dialogs.copyStorageError"
            @click="copyError"
          >
            <icon-lucide-check v-if="errorCopied" class="size-3" />
            <icon-lucide-copy v-else class="size-3" />
            <span>{{ errorCopied ? dialogs.copied : dialogs.copy }}</span>
          </button>
        </template>
        <p v-else-if="importing" class="text-xs text-muted" role="status">
          {{ dialogs.importingDeckFiles }}
        </p>
        <span v-else />
      </div>

      <div
        v-if="visibleDocuments.length"
        class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4"
      >
        <StorageDocumentCard
          v-for="document in visibleDocuments"
          :key="document.id"
          :document="document"
          :thumbnail-url="thumbnailUrls[document.id]"
          :sync-error="documentSyncErrors[document.id]?.body"
          :thumbnail-error="documentSyncErrors[document.id]?.thumbnail"
          :trash-view="folder === 'trash'"
          :busy="busyDocumentIds.has(document.id)"
          @open="openDocument"
          @rename="startRename"
          @duplicate="duplicateDocument"
          @trash="requestDelete($event, false)"
          @restore="restoreDocument"
          @delete-permanently="requestDelete($event, true)"
          @thumbnail-needed="requestDocumentThumbnail"
        />
      </div>

      <AppPlaceholder v-else-if="loading" :label="dialogs.loadingDocuments" size="page">
        <template #icon>
          <icon-lucide-loader-circle class="size-5 animate-spin" />
        </template>
      </AppPlaceholder>

      <!--
        One empty state, configured or not. The old copy — "Configure storage
        before using this workspace" — was accurate about the old behaviour and
        is now simply wrong: the workspace works, it just has nothing in it yet.
        Cloud is offered here, never demanded.
      -->
      <AppPlaceholder
        v-else
        :label="folder === 'trash' ? dialogs.emptyStorageTrash : dialogs.emptyStorageWorkspace"
        size="page"
      >
        <template #icon>
          <TrashIcon v-if="folder === 'trash'" class="size-5" />
          <icon-lucide-files v-else class="size-5" />
        </template>
        <template v-if="!configured && folder !== 'trash'" #action>
          <button
            type="button"
            class="rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-surface hover:bg-hover"
            @click="openSettingsDialog('storage')"
          >
            {{ dialogs.settingsStorage }}
          </button>
        </template>
      </AppPlaceholder>
    </section>

    <!--
      Always mounted. Grey "Local only" for an unconfigured workspace is a
      calm, accurate statement; hiding the chip until a listing had succeeded
      meant the one moment the user most needed sync state showed nothing.
    -->
    <footer
      class="flex h-5 shrink-0 items-center justify-center border-t border-border bg-panel px-2"
    >
      <CloudWorkspaceStatus />
    </footer>

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

    <AppDialogRoot v-model:open="renameOpen" size="sm" data-test-id="storage-rename-dialog">
      <AppDialogHeader
        :heading="dialogs.storageRename"
        :description="dialogs.storageRenameDescription"
        :close-label="dialogs.cancel"
      />
      <AppDialogBody>
        <input
          v-model="renameValue"
          class="w-full rounded border border-border bg-panel-field px-2.5 py-2 text-xs text-surface outline-none focus:border-panel-focus"
          :aria-label="dialogs.storageRename"
          @keydown.enter="commitRename"
        />
      </AppDialogBody>
      <AppDialogFooter>
        <DialogClose as-child>
          <button type="button" class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover">
            {{ dialogs.cancel }}
          </button>
        </DialogClose>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          @click="commitRename"
        >
          {{ dialogs.storageRename }}
        </button>
      </AppDialogFooter>
    </AppDialogRoot>

    <AppAlertDialogRoot v-model:open="deleteOpen" data-test-id="storage-delete-dialog">
      <div class="border-b border-border px-4 py-3">
        <AlertDialogTitle class="text-sm font-semibold text-surface">
          {{
            deletePermanently
              ? dialogs.storageDeletePermanentlyTitle
              : dialogs.storageMoveToTrashTitle
          }}
        </AlertDialogTitle>
      </div>
      <AppDialogBody>
        <AlertDialogDescription class="text-xs text-muted">
          {{ deleteDialogDescription }}
        </AlertDialogDescription>
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
            class="rounded bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90"
            @click="confirmDelete"
          >
            {{ deletePermanently ? dialogs.storageDeletePermanently : dialogs.storageMoveToTrash }}
          </button>
        </AlertDialogAction>
      </AppDialogFooter>
    </AppAlertDialogRoot>
  </main>
</template>
