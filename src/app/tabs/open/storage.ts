import { describeDiagnosticError, recordStorageFailure } from '@/app/diagnostics'
import { viewDiagnosticsAction } from '@/app/diagnostics/view'
import { readFigDocument } from '@/app/document/io/fig'
import type { EditorPreparationHandle } from '@/app/editor/preparation/types'
import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import {
  activeStorageProviderID,
  createStorageAdapter,
  sameStorageDocument,
  storageLocationOf,
  type StorageDocument,
  type StorageDocumentBinding,
  type StorageLocation
} from '@/app/integrations/storage'
import { rememberRecentStorageDocument } from '@/app/recent-files'
import { toast } from '@/app/shell/ui'
import { getLocalCanvasStore, type LocalCanvasMeta } from '@/app/storage/local-store'
import { seedStorageCanvasFromRemote } from '@/app/storage/sync/persist'
import { figFile } from '@/app/tabs/open/fig'
import {
  failPreparation,
  releaseOpeningTab,
  reusableTabStore,
  showImportedGraph
} from '@/app/tabs/open/show'
import { getTabsSnapshot, switchTab, type Tab } from '@/app/tabs/state'

/**
 * Whether this device's copy can open in place of downloading: it has unsent changes or a
 * conflict to resolve, or it is based on the revision the provider lists. Providers without
 * revisions fall back to comparing modification times.
 */
export function localCopyIsCurrent(local: LocalCanvasMeta, document: StorageDocument): boolean {
  if (local.syncStatus !== 'synced') return true
  if (document.revision != null) return local.remoteRevision === document.revision
  return !document.metadataAuthoritative || local.updatedAt >= document.updatedAt
}

/** A stored document's bytes: this device's copy when current, otherwise downloaded and kept. */
export async function readStorageDocument(
  binding: StorageDocumentBinding,
  document: StorageDocument,
  load: EditorPreparationHandle
): Promise<Uint8Array> {
  load.update({ phase: 'reading', detail: document.name })
  const local = getLocalCanvasStore()
  const localMetadata = await local.getMeta(document.id)
  load.signal.throwIfAborted()
  const localBytes = localMetadata?.hasFig ? await local.readFig(document.id) : null
  load.signal.throwIfAborted()
  if (localBytes && localMetadata && localCopyIsCurrent(localMetadata, document)) return localBytes

  const content = await createStorageAdapter(binding).getDocument(
    document.id,
    (progress) =>
      load.update({
        phase: 'reading',
        detail: document.name,
        completed: progress.transferredBytes,
        total: progress.totalBytes,
        unit: 'bytes'
      }),
    load.signal
  )
  await seedStorageCanvasFromRemote({
    ...storageLocationOf(binding),
    canvasId: document.id,
    name: document.name,
    updatedAt: document.updatedAt,
    figBytes: content.bytes,
    remoteRevision: content.revision
  })
  load.signal.throwIfAborted()
  return content.bytes
}

function findStorageTab(target: StorageDocumentBinding): Tab | undefined {
  return getTabsSnapshot().find((tab) => {
    const binding = tab.store.getStorageBinding()
    return binding !== null && sameStorageDocument(binding, target)
  })
}

async function showStorageDocument(
  store: EditorStore,
  binding: StorageDocumentBinding,
  document: StorageDocument,
  load: EditorPreparationHandle,
  given?: Uint8Array
): Promise<void> {
  const bytes = given ?? (await readStorageDocument(binding, document, load))
  const file = figFile(bytes, document.name)
  load.update({ phase: 'decoding', detail: document.name })
  const imported = await readFigDocument(file, load.signal)
  await showImportedGraph(
    store,
    imported,
    () => store.setStorageDocumentSource(binding, document.name),
    load
  )
}

/**
 * Shows what this device now holds for a tab's stored document, as after a conflict, or `bytes`
 * just taken from its storage.
 */
export async function reloadStorageDocumentInTab(
  store: EditorStore,
  bytes?: Uint8Array
): Promise<void> {
  const binding = store.getStorageBinding()
  if (!binding) return
  const name = store.state.documentName
  const load = store.preparationController.begin({ kind: 'storage-open', subject: name })
  try {
    await showStorageDocument(
      store,
      binding,
      { id: binding.documentId, name, updatedAt: new Date().toISOString() },
      load,
      bytes
    )
    load.complete()
  } catch (error) {
    failPreparation(load, 'read-failed', error)
    throw error
  }
}

export async function openStorageDocumentInNewTab(
  document: StorageDocument,
  location: StorageLocation = { providerId: activeStorageProviderID.value }
): Promise<EditorStore> {
  const binding: StorageDocumentBinding = {
    ...storageLocationOf(location),
    documentId: document.id
  }
  const existing = findStorageTab(binding)
  if (existing) {
    switchTab(existing.id)
    rememberRecentStorageDocument(binding, document.name, existing.store.state.documentKind)
    return existing.store
  }

  const opening = reusableTabStore()
  const { store } = opening
  store.state.documentName = document.name
  const load = store.preparationController.begin({
    kind: 'storage-open',
    subject: document.name
  })
  let succeeded = false
  try {
    await showStorageDocument(store, binding, document, load)
    rememberRecentStorageDocument(binding, document.name, store.state.documentKind)
    succeeded = true
  } catch (error) {
    if (!load.signal.aborted) {
      const diagnostic = describeDiagnosticError(error)
      load.fail({
        code: 'read-failed',
        message: error instanceof Error ? error.message : String(error),
        retryable: diagnostic.retryable ?? true
      })
      recordStorageFailure({ operation: 'download', ...diagnostic })
      toast.error(
        notificationMessages.get().openFileFailed({
          name: document.name,
          error: error instanceof Error ? error.message : String(error)
        }),
        viewDiagnosticsAction()
      )
    }
    await releaseOpeningTab(opening)
    throw error
  } finally {
    if (succeeded) load.complete()
  }
  return store
}
