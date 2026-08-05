<script setup lang="ts">
import { useClipboard, useEventListener, useOnline } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  permanentlyDeleteStorageDocuments,
  renameStorageDocument,
  restoreStorageDocument
} from '@/app/storage/documents'
import { storageCredentialsSatisfied } from '@/app/storage/configured'
import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import { useDocumentSyncErrors } from '@/app/storage/document-sync-errors'
import { createCanvasId } from '@/app/storage/id'
import { isSupportedStorageFile, prepareStorageImport } from '@/app/storage/import'
import { backupToCloud } from '@/app/storage/backup'
import { promoteLocalDocuments } from '@/app/storage/promote'
import {
  markListingConflicts,
  resolveStorageConflict,
  type ConflictResolution
} from '@/app/storage/conflict'
import { reconcileStorageDocuments } from '@/app/storage/reconcile'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { sortStorageDocuments, type StorageSortMode } from '@/app/storage/sort'
import { createStorageDocument } from '@/app/storage/create-document'
import { currentTargetIdFor, type StorageTargetID } from '@/app/storage/target'
import {
  deviceStorageDocuments,
  mergeDeviceStorageDocuments,
  storageDocumentInScope,
  storageDocumentLocation,
  storageDocumentNeedsItsOwnTarget,
  storageDocumentPlacements,
  type StorageDocumentLocation,
  type StorageDocumentLocationBadge,
  type StorageDocumentPlacement,
  type StorageDocumentScope
} from '@/app/storage/visibility'
import {
  categorizeSyncFailure,
  clearSyncFailure,
  enqueuePutCanvas,
  enqueuePutThumb,
  getOutbox,
  lastSyncFailure,
  persistStorageCanvasLocally,
  recordSyncFailure,
  setSyncUi,
  syncUiState
} from '@/app/storage/sync'
import { createStorageThumbnail, isUsableStorageThumbnail } from '@/app/storage/thumbnail'
import { nextUniqueStorageName } from '@/app/storage/unique-name'
import { beginExplicitOpen, flushOpenTabSaves, openStorageDocumentInNewTab } from '@/app/tabs'
import StorageDocumentCard from '@/components/storage/StorageDocumentCard.vue'
import StorageConflictDialog from '@/components/storage/StorageConflictDialog.vue'
import RefreshIcon from '@/components/storage/RefreshIcon.vue'
import TrashIcon from '@/components/storage/TrashIcon.vue'
import CloudWorkspaceStatus from '@/components/storage/CloudWorkspaceStatus.vue'
import LocalDurabilityNotice from '@/components/storage/LocalDurabilityNotice.vue'
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
const route = useRoute()
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
/**
 * Which destinations the user chose to look at. Defaults to all: narrowing is
 * a view someone selects, never a rule the app imposes, and the imposed version
 * of it is what hid every document with no destination.
 */
const scope = ref<StorageDocumentScope>('all')
/** Destination of each row, by document id — for badges and the scope filter. */
const documentPlacements = ref<Record<string, StorageDocumentPlacement>>({})
const busyDocumentIds = ref<Set<string>>(new Set())
const renameOpen = ref(false)
const renameTarget = ref<StorageDocument | null>(null)
const renameValue = ref('')
const deleteOpen = ref(false)
const deleteTarget = ref<StorageDocument | null>(null)
const deletePermanently = ref(false)
const emptyTrashRequested = ref(false)
const conflictedDocumentIds = ref<Set<string>>(new Set())
const conflictOpen = ref(false)
const conflictTarget = ref<StorageDocument | null>(null)
const thumbnailUrls = ref<Record<string, string>>({})
/**
 * Rows with no local body that the last listing did not contain.
 *
 * Derived from the listing and never persisted, which is the whole recovery
 * mechanism: every refresh recomputes the set from scratch, so a document that
 * was merely mid-replacement on another device becomes ordinary again the first
 * time it is listed, with nothing for the user to do. Persisting this would
 * turn a transient absence into a sticky state that needs clearing.
 */
const unavailableDocumentIds = ref<Set<string>>(new Set())
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

/** The destination this device currently points at, or null for none. */
const activeTargetId = computed(() => currentTargetIdFor(activeStorageProviderID.value))
/**
 * Trash is already a narrowing, and there is nothing to narrow to without a
 * destination — in both cases the selected scope would only produce an empty
 * list with no way to read why.
 */
const effectiveScope = computed<StorageDocumentScope>(() =>
  folder.value === 'trash' || activeTargetId.value === null ? 'all' : scope.value
)
/** Everything in this folder on this device, before the user's scope narrows it. */
const folderDocuments = computed(() =>
  documents.value.filter((document) =>
    folder.value === 'trash' ? document.trashedAt !== null : document.trashedAt === null
  )
)
const visibleDocuments = computed(() =>
  sortStorageDocuments(
    folderDocuments.value.filter((document) =>
      storageDocumentInScope(
        documentPlacements.value[document.id],
        effectiveScope.value,
        activeTargetId.value
      )
    ),
    sortMode.value
  )
)
const trashedDocumentCount = computed(
  () => documents.value.filter((document) => document.trashedAt !== null).length
)
/**
 * Location badge per card.
 *
 * A row the local index has not seen yet came from the active target's own
 * listing, so that is where it lives until the seed writes it down.
 */
const documentLocations = computed<Record<string, StorageDocumentLocationBadge>>(() => {
  const badges: Record<string, StorageDocumentLocationBadge> = {}
  for (const document of documents.value) {
    const placement = documentPlacements.value[document.id] ?? {
      syncTargetId: activeTargetId.value,
      lastKnownTargetId: null
    }
    const location = storageDocumentLocation(placement, activeTargetId.value)
    badges[document.id] = { kind: location.kind, label: locationLabel(location) }
  }
  return badges
})
const showEmptyDurability = computed(() => folder.value === 'documents' && !configured.value)
/**
 * The scope is hiding documents that exist.
 *
 * Distinguishing this from a device that holds nothing is the whole point of
 * the empty state: "No stored documents yet." over twenty-three documents is
 * the message that made a full library read as lost.
 */
const scopeHidesDocuments = computed(
  () => visibleDocuments.value.length === 0 && folderDocuments.value.length > 0
)
const sortOptions = computed(() => [
  { value: 'name-asc' as const, label: dialogs.value.storageSortNameAsc },
  { value: 'name-desc' as const, label: dialogs.value.storageSortNameDesc },
  { value: 'date-desc' as const, label: dialogs.value.storageSortNewest },
  { value: 'date-asc' as const, label: dialogs.value.storageSortOldest }
])
const scopeOptions = computed(() => [
  { value: 'all' as const, label: dialogs.value.storageScopeAll },
  { value: 'active-target' as const, label: dialogs.value.storageScopeActiveTarget }
])
/**
 * The durability notice speaks for an empty device. Documents the scope is
 * hiding are the more urgent truth and take the empty state from it.
 */
const durabilityEmptyState = computed(() => showEmptyDurability.value && !scopeHidesDocuments.value)
const emptyStateLabel = computed(() => {
  if (folder.value === 'trash') return dialogs.value.emptyStorageTrash
  if (scopeHidesDocuments.value) {
    return dialogs.value.emptyStorageAtDestination({ count: folderDocuments.value.length })
  }
  if (durabilityEmptyState.value) return dialogs.value.localDurabilityTitle
  return dialogs.value.emptyStorageWorkspace
})

/**
 * A location in the user's words.
 *
 * A target whose provider this build no longer ships resolves to no label at
 * all; the badge then names a neutral destination rather than an id or a
 * thrown error.
 */
function locationLabel(location: StorageDocumentLocation): string {
  const provider = location.providerLabel ?? dialogs.value.storageLocationUnknownProvider
  // Both backed-up kinds name their destination. "Backed up here" read as "on
  // this device" — the opposite of what it meant — and it was the only badge
  // that withheld the one fact the badge exists to give. The `kind` still
  // distinguishes the active destination for styling and `data-location`.
  if (location.kind === 'backed-up-here' || location.kind === 'backed-up-elsewhere') {
    return dialogs.value.storageLocationBackedUpTo({ provider })
  }
  if (location.kind === 'detached') return dialogs.value.storageLocationDetachedFrom({ provider })
  return dialogs.value.storageLocationDeviceOnly
}
/**
 * The destination in the user's words. The provider label alone would not
 * distinguish two buckets on the same provider, and "unavailable" is only
 * actionable if it says unavailable WHERE.
 *
 * Non-secret preference fields only — the same allowlist the bug-report copy
 * uses, so no credential can reach a tooltip.
 */
const targetLabel = computed(() => {
  const context = Object.values(nonSecretProviderContext(provider.value.id))
  return context.length ? `${provider.value.label} (${context.join(' · ')})` : provider.value.label
})
const deleteDialogDescription = computed(() => {
  if (emptyTrashRequested.value) return dialogs.value.storageEmptyTrashDescription
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

  // A locally cached preview is still worth showing for an unavailable row —
  // it is free and it keeps the card recognisable. What follows is not: the
  // target does not list this document, so its preview fetch 404s and the
  // backfill below would download a whole document that is not there.
  if (unavailableDocumentIds.value.has(document.id)) return

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
  // afterwards would attribute this pass's sync errors to a different bucket.
  const targetId = currentTargetIdFor(providerId)
  // Every row on the device. The destination decides what a card SAYS, never
  // whether it appears: narrowing here is what left rows with no destination
  // matching no query at all, so twenty-three documents rendered nowhere.
  const local = await getLocalCanvasStore().listMetas()
  if (!isCurrentRefresh(generation, providerId)) return
  // Nothing is unavailable until a listing says so. Clearing here also clears it
  // when the listing FAILS, which is correct: an unreachable bucket is evidence
  // about the bucket, never about one document's absence from it.
  unavailableDocumentIds.value = new Set()
  documents.value = deviceStorageDocuments(local)
  documentPlacements.value = storageDocumentPlacements(local)
  // Sync errors stay attributed to the destination that produced them — a
  // failure against this bucket says nothing about a row that syncs elsewhere.
  setDocumentSyncErrors(local.filter((metadata) => metadata.syncTargetId === targetId))
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

/**
 * Send documents written before this bucket existed to the bucket that now
 * does. Connecting a destination should sweep them up, not leave them behind —
 * which is what makes a fresh connection look like it silently did nothing.
 *
 * Returns the ids it retargeted, because the caller read the index BEFORE this
 * ran and would otherwise badge those rows against the destination they just
 * left.
 */
async function promoteForBackup(targetId: StorageTargetID | null): Promise<string[]> {
  if (!backupToCloud.value || !targetId) return []
  return (await promoteLocalDocuments(targetId)).promoted
}

async function refresh(): Promise<void> {
  // Pin the provider for the whole pass, BEFORE any await. Reading the live ref
  // afterwards would attribute this listing to whichever provider is active by
  // then — and every await below is a window for the user to switch.
  const providerId = activeStorageProviderID.value
  // Pin the DESTINATION too, not just the provider. `isCurrentRefresh` compares
  // provider ids only, so editing the bucket mid-listing passes that guard while
  // silently retagging every row this pass seeds.
  const targetId = currentTargetIdFor(providerId)
  const generation = ++refreshGeneration

  // Land pending edits from open tabs: the grid paints thumbnails from
  // persisted bytes, so a save still sitting in the autosave debounce would
  // show the card with the stale stage colour.
  await flushOpenTabSaves()
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
    const allLocal = await localStore.listMetas(true)
    // Reconciliation stays narrowed to the destination that produced the
    // listing: every absence-sensitive output it computes reads a missing id as
    // "missing from ITS OWN target", which is only true under this narrowing.
    // What must not stay narrowed is the list the user sees.
    const local = allLocal.filter((metadata) => metadata.syncTargetId === targetId)
    if (!isCurrentRefresh(generation, providerId)) return
    // Listing works again. Clear only OUR failure — an outbox failure is the
    // engine's to own and clearing it here would hide real unsent work.
    if (lastSyncFailure.value?.operation === 'listDocuments') {
      clearSyncFailure()
      if (syncUiState.value === 'error') setSyncUi('idle')
    }
    const promoted = await promoteForBackup(targetId)

    const reconciliation = reconcileStorageDocuments(local, remote)
    // The reconciled rows for this destination, plus every other row held on
    // this device. Switching destination changes what the badges say, never how
    // many documents exist.
    documents.value = mergeDeviceStorageDocuments(reconciliation.documents, allLocal)
    const placements = storageDocumentPlacements(allLocal)
    // Promotion retargeted these rows after the index was read. Badging them
    // from the snapshot would say "on this device only" about documents that
    // are on their way to the bucket the user just connected.
    for (const id of promoted) {
      placements[id] = {
        syncTargetId: targetId,
        lastKnownTargetId: targetId,
        hasLocalBody: placements[id]?.hasLocalBody
      }
    }
    documentPlacements.value = placements
    // Listing-time conflict detection: remote movement underneath a pending
    // local edit marks the row before the next drain would overwrite it.
    const newConflicts = await markListingConflicts(localStore, local, remote)
    conflictedDocumentIds.value = new Set([
      ...local
        .filter((metadata) => metadata.syncStatus === 'conflict')
        .map((metadata) => metadata.id),
      ...newConflicts
    ])
    // Recomputed wholesale, so a row listed again this pass is simply not in the
    // new set and needs no clearing of its own. Nothing is deleted either way.
    unavailableDocumentIds.value = new Set(reconciliation.unavailableIds)
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
        lastSyncError: null,
        // A fresh device adopts the remote's published state as its conflict
        // base: it has no edits of its own yet, so there is nothing to lose.
        baseStateId: document.stateId ?? null
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
  // The card already refuses to emit for these; refusing here too keeps the
  // guarantee with the state that owns it rather than with the presentation.
  if (unavailableDocumentIds.value.has(document.id)) return
  // Listed, and honestly badged, but not openable from here: the bytes exist
  // only at a destination this device is not pointed at. Opening would ask the
  // ACTIVE bucket for an id it never held, so say where the document lives
  // instead of surfacing that provider's 404.
  const placement = documentPlacements.value[document.id]
  if (storageDocumentNeedsItsOwnTarget(placement, activeTargetId.value)) {
    const location = storageDocumentLocation(
      placement ?? { syncTargetId: null },
      activeTargetId.value
    )
    error.value = dialogs.value.storageDocumentElsewhereOnly({
      name: document.name,
      provider: location.providerLabel ?? dialogs.value.storageLocationUnknownProvider
    })
    return
  }
  // Declare the intent BEFORE routing: the editor mounts during the push and
  // would otherwise read an empty tab list as a cold start and restore the
  // previous session on top of the document being opened.
  const openDone = beginExplicitOpen()
  try {
    await router.push('/editor')
    await nextTick()
    await openStorageDocumentInNewTab(document)
  } finally {
    openDone()
  }
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

/**
 * Record where a document just written on this device belongs.
 *
 * Optimistic rows are painted before the next listing reads them back, and a
 * row with no recorded placement is assumed to belong to the active target —
 * which is wrong for a document written while no destination is configured.
 */
function rememberPlacement(documentId: string, targetId: StorageTargetID | null): void {
  documentPlacements.value = {
    ...documentPlacements.value,
    [documentId]: { syncTargetId: targetId, lastKnownTargetId: targetId, hasLocalBody: true }
  }
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
  // Pin the destination alongside the provider, BEFORE any await. The bucket
  // can be re-pointed while the copy is being written, and asking afterwards
  // would badge the new row against a destination it never used.
  const providerId = activeStorageProviderID.value
  const targetId = currentTargetIdFor(providerId)
  setDocumentBusy(document.id, true)
  error.value = null
  try {
    const name = nextUniqueStorageName(
      `${document.name} copy`,
      documents.value.map((item) => item.name)
    )
    const duplicated = await duplicateStorageDocument(providerId, document, name)
    documents.value = [duplicated.document, ...documents.value]
    rememberPlacement(duplicated.document.id, targetId)
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
  emptyTrashRequested.value = false
  deleteTarget.value = document
  deletePermanently.value = permanent
  deleteOpen.value = true
}

function requestEmptyTrash(): void {
  emptyTrashRequested.value = true
  deleteTarget.value = null
  deletePermanently.value = true
  deleteOpen.value = true
}

async function confirmEmptyTrash(): Promise<void> {
  const trashed = documents.value.filter((document) => document.trashedAt !== null)
  for (const document of trashed) setDocumentBusy(document.id, true)
  error.value = null

  try {
    const result = await permanentlyDeleteStorageDocuments(activeStorageProviderID.value, trashed)
    const deletedIds = new Set(result.deleted.map((document) => document.id))
    documents.value = documents.value.filter((document) => !deletedIds.has(document.id))
    for (const document of result.deleted) removeThumbnailUrl(document.id)
    if (result.failed.length) {
      error.value = result.failed
        .map(
          ({ document, reason }) =>
            `${document.name}: ${reason instanceof Error ? reason.message : String(reason)}`
        )
        .join('\n')
    }
    deleteOpen.value = false
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    for (const document of trashed) setDocumentBusy(document.id, false)
    emptyTrashRequested.value = false
  }
}

function requestResolveConflict(document: StorageDocument): void {
  conflictTarget.value = document
  conflictOpen.value = true
}

async function handleConflictResolve(resolution: ConflictResolution): Promise<void> {
  const target = conflictTarget.value
  if (!target) return
  // Pin the provider across the awaits — the user can switch mid-resolution.
  const providerId = activeStorageProviderID.value
  setDocumentBusy(target.id, true)
  error.value = null
  try {
    await resolveStorageConflict(target.id, resolution, {
      store: getLocalCanvasStore(),
      outbox: getOutbox(),
      adapter: createActiveStorageAdapter(providerId),
      enqueueCanvas: enqueuePutCanvas,
      createId: createCanvasId
    })
    conflictedDocumentIds.value = new Set(
      [...conflictedDocumentIds.value].filter((id) => id !== target.id)
    )
    await refresh()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    setDocumentBusy(target.id, false)
  }
}

async function confirmDelete(): Promise<void> {
  // Pin the destination before any await: reading the live provider after a
  // suspension asks a question whose answer may have moved.
  const providerId = activeStorageProviderID.value
  if (emptyTrashRequested.value) {
    await confirmEmptyTrash()
    return
  }
  const target = deleteTarget.value
  if (!target) return
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
  await createStorageDocument(sourceFormat, router)
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

async function importDroppedFiles(files: File[]): Promise<void> {
  // No cloud is not a reason to refuse an import — the document lands locally
  // and uploads later if a destination is ever configured.
  if (importing.value) return
  const supported = files.filter((file) => isSupportedStorageFile(file.name))
  if (supported.length === 0) {
    error.value = dialogs.value.storageSupportedFilesOnly
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
    for (const file of supported) {
      try {
        const prepared = await prepareStorageImport(file)
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
        rememberPlacement(id, targetId)
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
  void importDroppedFiles(Array.from(event.dataTransfer?.files ?? []))
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

const importInput = ref<HTMLInputElement | null>(null)

function pickFilesToImport(): void {
  importInput.value?.click()
}

function onImportPicked(event: Event): void {
  const input = event.target as HTMLInputElement
  void importDroppedFiles(Array.from(input.files ?? []))
  // Clear it so choosing the same file twice in a row still fires a change.
  input.value = ''
}

onMounted(() => {
  // The Create menu in the tab strip sends the user here to import, because
  // this view owns the picker, the naming and the error surface.
  if (route.query.import) {
    void router.replace({ path: '/', query: {} })
    void nextTick(pickFilesToImport)
  }
  void refresh()
})

onBeforeUnmount(clearThumbnailUrls)
</script>

<template>
  <!-- h-full, not h-screen: the tab strip sits above this view now, so a full
       viewport height here pushes the sync status bar below the fold. -->
  <main
    ref="workspace"
    class="relative flex h-full min-h-0 flex-col overflow-hidden bg-app text-surface"
    data-test-id="storage-workspace"
    :aria-busy="importing"
  >
    <header class="flex h-14 items-center border-b border-border px-6">
      <div>
        <h1 class="text-sm font-semibold">{{ dialogs.storageWorkspace }}</h1>
      </div>
      <div class="ml-auto flex gap-2">
        <button
          type="button"
          data-test-id="app-settings-trigger"
          class="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
          @click="openSettingsDialog()"
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

    <input
      ref="importInput"
      type="file"
      accept=".fig,.deck"
      multiple
      class="hidden"
      data-test-id="storage-import-input"
      @change="onImportPicked"
    />

    <LocalDurabilityNotice v-if="documents.length > 0 && !configured" />

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
        <button
          v-if="folder === 'trash' && trashedDocumentCount"
          type="button"
          class="flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded px-2 text-xs text-danger hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="busyDocumentIds.size > 0"
          data-test-id="storage-empty-trash"
          @click="requestEmptyTrash"
        >
          <TrashIcon class="size-3.5" />
          <span>{{ dialogs.storageEmptyTrash }}</span>
        </button>
        <div class="ml-auto flex items-center gap-1.5">
          <!--
            A view the user selects, never a rule imposed on them — and never a
            destination change: this touches nothing outside the grid.
          -->
          <AppSelect
            v-if="folder === 'documents' && activeTargetId"
            v-model="scope"
            :options="scopeOptions"
            :label="dialogs.storageScope"
            class="min-w-40"
            data-test-id="storage-scope"
          />
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
          {{ dialogs.importingStorageFiles }}
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
          :conflicted="conflictedDocumentIds.has(document.id)"
          :trash-view="folder === 'trash'"
          :busy="busyDocumentIds.has(document.id)"
          :unavailable="unavailableDocumentIds.has(document.id)"
          :target-label="targetLabel"
          :location="documentLocations[document.id]"
          @open="openDocument"
          @rename="startRename"
          @duplicate="duplicateDocument"
          @trash="requestDelete($event, false)"
          @restore="restoreDocument"
          @delete-permanently="requestDelete($event, true)"
          @resolve-conflict="requestResolveConflict"
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

        An empty list can be correct, but only when it says WHICH emptiness it
        means. A destination that holds nothing while the device holds documents
        reports the count and offers to widen the scope.
      -->
      <AppPlaceholder
        v-else
        :label="emptyStateLabel"
        :description="durabilityEmptyState ? dialogs.localDurabilityEmptyBody : undefined"
        size="page"
        :data-test-id="
          scopeHidesDocuments
            ? 'storage-scope-empty'
            : durabilityEmptyState
              ? 'local-durability-notice'
              : undefined
        "
        :data-placement="durabilityEmptyState ? 'empty' : undefined"
      >
        <template #icon>
          <TrashIcon v-if="folder === 'trash'" class="size-5" />
          <icon-lucide-cloud-off v-else-if="scopeHidesDocuments" class="size-5" />
          <icon-lucide-hard-drive v-else-if="durabilityEmptyState" class="size-5" />
          <icon-lucide-files v-else class="size-5" />
        </template>
        <template v-if="scopeHidesDocuments || (!configured && folder !== 'trash')" #action>
          <button
            v-if="scopeHidesDocuments"
            type="button"
            class="rounded border border-border bg-panel px-3 py-1.5 text-xs font-medium text-surface hover:bg-hover"
            data-test-id="storage-scope-show-all"
            @click="scope = 'all'"
          >
            {{ dialogs.storageShowAllDocuments }}
          </button>
          <button
            v-else
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
        <p class="text-sm font-medium">{{ dialogs.dropStorageFiles }}</p>
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

    <StorageConflictDialog
      v-model:open="conflictOpen"
      :document="conflictTarget"
      @resolve="handleConflictResolve"
    />

    <AppAlertDialogRoot v-model:open="deleteOpen" data-test-id="storage-delete-dialog">
      <div class="border-b border-border px-4 py-3">
        <AlertDialogTitle class="text-sm font-semibold text-surface">
          {{
            emptyTrashRequested
              ? dialogs.storageEmptyTrashTitle
              : deletePermanently
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
            {{
              emptyTrashRequested
                ? dialogs.storageEmptyTrash
                : deletePermanently
                  ? dialogs.storageDeletePermanently
                  : dialogs.storageMoveToTrash
            }}
          </button>
        </AlertDialogAction>
      </AppDialogFooter>
    </AppAlertDialogRoot>
  </main>
</template>
