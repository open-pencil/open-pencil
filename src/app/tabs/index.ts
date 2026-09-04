import { promiseTimeout } from '@vueuse/core'
import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { findFigThumbnailPageId } from '@open-pencil/core/io/formats/fig'
import { renderThumbnail } from '@open-pencil/core/io/formats/raster'
import { populateLazyFigImportRoots } from '@open-pencil/core/kiwi'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
import { getCloudDocumentAccess } from '@/app/collab/cloud-sharing'
import { describeDiagnosticError, recordStorageFailure } from '@/app/diagnostics'
import { readFigDocument } from '@/app/document/io/fig'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { getRecoveryStore, type RecoverySnapshotMeta } from '@/app/document/recovery'
import { setActiveEditorStore } from '@/app/editor/active-store'
import type { EditorPreparationHandle as DocumentLoadSession } from '@/app/editor/preparation/types'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  type StorageDocument,
  type StorageDocumentBinding
} from '@/app/integrations/storage'
import { activeCloudConnectionProfile } from '@/app/integrations/storage/cloud/profiles'
import {
  cacheRecentFileThumbnail,
  loadCachedRecentFileThumbnail,
  rememberRecentStorageDocument
} from '@/app/recent-files'
import { toast } from '@/app/shell/ui'
import { storageCanvasId } from '@/app/storage/id'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import {
  seedStorageCanvasFromRemote,
  type SeedStorageCanvasOptions
} from '@/app/storage/sync/persist'
import { emitActiveDocumentOpened } from '@/app/tabs/events'
import { createFileOpenCoordinator } from '@/app/tabs/open/coordinator'
import { findTabByFileIdentity } from '@/app/tabs/open/identity'

export type TabKind = 'home' | 'document'

export interface Tab {
  id: string
  store: EditorStore
  kind: TabKind
}

const io = new IORegistry(BUILTIN_IO_FORMATS)
const fileOpenCoordinator = createFileOpenCoordinator()
const RECENT_FILE_THUMBNAIL_SIZE = 512
const coverThumbnailListeners = new WeakMap<EditorStore, () => void>()

let nextTabId = 1

function generateTabId(): string {
  return `tab-${nextTabId++}`
}

const tabsRef = shallowRef<Tab[]>([])
const activeTabId = shallowRef('')

export const activeTab = computed(() => tabsRef.value.find((t) => t.id === activeTabId.value))

export const allTabs = computed(() =>
  tabsRef.value.map((t) => ({
    id: t.id,
    name: t.store.state.documentName,
    isHome: t.kind === 'home',
    isPreparing: t.store.state.preparation !== null,
    preparationProgress: t.store.state.preparation?.progress ?? null,
    isActive: t.id === activeTabId.value
  }))
)

export function getActiveStore(): EditorStore {
  const tab = tabsRef.value.find((t) => t.id === activeTabId.value)
  if (!tab) throw new Error('No active tab')
  return tab.store
}

export function getActiveTabId(): string {
  return activeTabId.value
}

export function getTabById(tabId: string): Tab | undefined {
  return tabsRef.value.find((tab) => tab.id === tabId)
}

export function getTabForStore(store: EditorStore): Tab | undefined {
  return tabsRef.value.find((tab) => tab.store === store)
}

export function getTabsSnapshot(): Tab[] {
  return [...tabsRef.value]
}

export function createTab(store?: EditorStore, initialGraph?: SceneGraph): Tab {
  const s = store ?? createEditorStore(initialGraph)
  const tab: Tab = { id: generateTabId(), store: s, kind: 'document' }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
  return tab
}

export function createHomeTab(): Tab {
  const tab: Tab = { id: generateTabId(), store: createEditorStore(), kind: 'home' }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
  return tab
}

export function leaveHome(tabId: string): void {
  const tabIndex = tabsRef.value.findIndex((candidate) => candidate.id === tabId)
  if (tabIndex === -1) return
  const tab = tabsRef.value[tabIndex]
  if (tab.kind !== 'home') return
  tabsRef.value = tabsRef.value.with(tabIndex, { ...tab, kind: 'document' })
}

export function createDocumentInCurrentTab(): Tab {
  const current = activeTab.value
  if (current?.kind !== 'home') return createTab()
  leaveHome(current.id)
  return getTabById(current.id) ?? current
}

export function showNewTab(): void {
  const homeTab = tabsRef.value.find((tab) => tab.kind === 'home')
  if (homeTab) {
    switchTab(homeTab.id)
    return
  }
  createHomeTab()
}

function activateTab(tab: Tab) {
  const previous = tabsRef.value.find((candidate) => candidate.id === activeTabId.value)
  previous?.store.setSnapGuides([])
  previous?.store.setLayoutInsertIndicator(null)
  previous?.store.setDropTarget(null)
  activeTabId.value = tab.id
  setActiveEditorStore(tab.store)
  triggerRef(tabsRef)
  setOpenPencilStore(tab.store)
}

export function switchTab(tabId: string) {
  const tab = tabsRef.value.find((t) => t.id === tabId)
  if (!tab) return
  activateTab(tab)
}

export async function closeTab(tabId: string): Promise<void> {
  const idx = tabsRef.value.findIndex((t) => t.id === tabId)
  if (idx === -1) return

  const closingTab = tabsRef.value[idx]
  if (closingTab.kind === 'home' && tabsRef.value.length === 1) return
  const wasActive = activeTabId.value === tabId
  coverThumbnailListeners.get(closingTab.store)?.()
  coverThumbnailListeners.delete(closingTab.store)
  closingTab.store.preparationController.dispose()
  await closingTab.store.persistRecoveryNow()
  closingTab.store.dispose()
  tabsRef.value = tabsRef.value.filter((t) => t.id !== tabId)

  if (tabsRef.value.length === 0) {
    createHomeTab()
    return
  }

  if (wasActive) {
    const newIdx = Math.min(idx, tabsRef.value.length - 1)
    activateTab(tabsRef.value[newIdx])
  }
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function isDOMImportFile(file: File): boolean {
  return /\.(html?|xhtml)$/i.test(file.name)
}

function reusableTabStore(): { store: EditorStore; created: boolean } {
  const current = activeTab.value
  if (current?.kind === 'home') {
    leaveHome(current.id)
    return { store: current.store, created: false }
  }
  const isUntouched =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
  if (isUntouched) {
    leaveHome(current.id)
    return { store: current.store, created: false }
  }
  return { store: createTab().store, created: true }
}

async function readFigForTab(file: File, signal?: AbortSignal): Promise<SceneGraph> {
  const imported = await readFigDocument(file, signal)
  const firstPageId = imported.getPages()[0]?.id
  if (firstPageId) computeAllLayouts(imported, firstPageId)
  const coverPageId = findFigThumbnailPageId(imported.getPages())
  if (coverPageId && coverPageId !== firstPageId) {
    populateLazyFigImportRoots(imported, [coverPageId])
    computeAllLayouts(imported, coverPageId)
  }
  return imported
}

async function showImportedGraph(
  store: EditorStore,
  graph: SceneGraph,
  prepare?: () => void | Promise<void>,
  load?: DocumentLoadSession
): Promise<void> {
  load?.update({ phase: 'materializing', detail: store.state.documentName })
  await applyImportedDocument(store, graph, load)
  load?.signal.throwIfAborted()
  await prepare?.()
  load?.signal.throwIfAborted()
  const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
  load?.update({ phase: 'populating-page', detail: store.graph.getNode(pageId)?.name ?? null })
  await store.switchPage(pageId, { preparation: load })
  load?.signal.throwIfAborted()
  load?.update({ phase: 'preparing-render', detail: store.state.documentName })
  await store.fitCurrentPageToViewport()
}

async function cacheOpenedFigCover(path: string, store: EditorStore): Promise<void> {
  if (await loadCachedRecentFileThumbnail(path)) return
  const coverPageId = findFigThumbnailPageId(store.graph.getPages())
  if (!coverPageId) return
  for (let attempt = 0; attempt < 240 && !store.renderer; attempt++) {
    await promiseTimeout(250)
  }
  const renderer = store.renderer
  if (!renderer) {
    console.warn('[Recent files] Cover thumbnail skipped because the renderer was unavailable')
    return
  }
  const bytes = renderThumbnail(
    renderer.ck,
    renderer,
    store.graph,
    coverPageId,
    RECENT_FILE_THUMBNAIL_SIZE,
    RECENT_FILE_THUMBNAIL_SIZE
  )
  if (!bytes) {
    console.warn('[Recent files] Cover thumbnail skipped because the Cover page was empty')
    return
  }
  await cacheRecentFileThumbnail(path, bytes)
}

function watchOpenedFigCover(path: string, store: EditorStore): void {
  coverThumbnailListeners.get(store)?.()
  const coverPageId = findFigThumbnailPageId(store.graph.getPages())
  if (!coverPageId) return
  coverThumbnailListeners.set(
    store,
    store.onEditorEvent('page:changed', (pageId) => {
      if (pageId !== coverPageId) return
      void cacheOpenedFigCover(path, store).catch((error) => {
        console.warn('[Recent files] Failed to cache the Cover thumbnail', error)
      })
    })
  )
}

function findStorageTab(
  providerId: string,
  documentId: string,
  connectionId?: string
): Tab | undefined {
  return tabsRef.value.find((tab) => {
    const binding = tab.store.getStorageBinding()
    if (binding?.providerId !== providerId || binding.documentId !== documentId) return false
    return providerId === 'openpencil-cloud'
      ? binding.connectionId === connectionId
      : connectionId === undefined
  })
}

function failPreparation(
  load: DocumentLoadSession,
  code: 'read-failed' | 'decode-failed',
  error: unknown
): void {
  if (load.signal.aborted) return
  load.fail({
    code,
    message: error instanceof Error ? error.message : String(error),
    retryable: true
  })
}

type StorageOpenIdentity = {
  providerId: string
  canvasId: string
  binding: StorageDocumentBinding
}

function storageOpenIdentity(providerId: string, documentId: string): StorageOpenIdentity {
  if (providerId !== 'openpencil-cloud') {
    return {
      providerId,
      canvasId: storageCanvasId({ providerId, documentId }),
      binding: { providerId, documentId }
    }
  }
  const profile = activeCloudConnectionProfile()
  if (!profile?.selectedWorkspaceId)
    throw new Error('OpenPencil Cloud connection and workspace are required')
  return {
    providerId,
    canvasId: storageCanvasId({
      providerId: 'openpencil-cloud',
      connectionId: profile.id,
      documentId
    }),
    binding: {
      providerId: 'openpencil-cloud',
      connectionId: profile.id,
      workspaceId: profile.selectedWorkspaceId,
      documentId
    }
  }
}

export async function openStorageDocumentInNewTab(document: StorageDocument): Promise<void> {
  const identity = storageOpenIdentity(activeStorageProviderID.value, document.id)
  const connectionId =
    identity.binding.providerId === 'openpencil-cloud' ? identity.binding.connectionId : undefined
  const existing = findStorageTab(identity.providerId, document.id, connectionId)
  if (existing) {
    switchTab(existing.id)
    rememberRecentStorageDocument(identity.providerId, document.id, document.name)
    return
  }

  const { store, created } = reusableTabStore()
  store.state.documentName = document.name
  const load = store.preparationController.begin({
    kind: 'storage-open',
    subject: document.name
  })
  let succeeded = false
  try {
    load.update({ phase: 'reading', detail: document.name })
    const local = getLocalCanvasStore()
    const localMetadata = await local.getMeta(identity.canvasId)
    load.signal.throwIfAborted()
    const localBytes = localMetadata?.hasFig ? await local.readFig(identity.canvasId) : null
    load.signal.throwIfAborted()
    const localIsAuthoritative =
      localMetadata?.syncStatus !== 'synced' ||
      !document.metadataAuthoritative ||
      localMetadata.updatedAt >= document.updatedAt
    let bytes = localBytes && localIsAuthoritative ? localBytes : null

    if (!bytes) {
      bytes = await createActiveStorageAdapter(identity.providerId).getDocument(
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
      const seedOptions: SeedStorageCanvasOptions = {
        providerId: identity.providerId,
        documentId: document.id,
        canvasId: identity.canvasId,
        name: document.name,
        updatedAt: document.updatedAt,
        figBytes: bytes
      }
      if (identity.binding.providerId === 'openpencil-cloud') {
        seedOptions.connectionId = identity.binding.connectionId
        seedOptions.workspaceId = identity.binding.workspaceId
      }
      await seedStorageCanvasFromRemote(seedOptions)
      load.signal.throwIfAborted()
    }

    const fileBytes = new Uint8Array(bytes.byteLength)
    fileBytes.set(bytes)
    const file = new File([fileBytes.buffer], `${document.name}.fig`, {
      type: 'application/octet-stream'
    })
    load.update({ phase: 'decoding', detail: document.name })
    const imported = await readFigForTab(file, load.signal)
    await showImportedGraph(
      store,
      imported,
      async () => {
        store.setStorageDocumentSource(identity.binding, document.name)
        setActiveEditorStore(store)
        if (identity.providerId === 'openpencil-cloud') {
          const access = await getCloudDocumentAccess(store)
          store.setAccessMode(access.sources.includes('owner') ? 'owner' : access.permission)
        } else store.setAccessMode('owner')
      },
      load
    )
    rememberRecentStorageDocument(identity.providerId, document.id, document.name)
    emitActiveDocumentOpened(store)
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
        })
      )
    }
    if (created) {
      const tab = getTabForStore(store)
      if (tab) await closeTab(tab.id)
    }
    throw error
  } finally {
    if (succeeded) load.complete()
  }
}

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  const identity: DocumentSourceIdentity = {
    handle: handle ?? null,
    path: path ?? null
  }
  const decision = await fileOpenCoordinator.decide(async () => {
    const pending = await fileOpenCoordinator.findPending(identity)
    if (pending) {
      const tab = getTabForStore(pending.store)
      if (tab) switchTab(tab.id)
      return { kind: 'pending' as const, completion: pending.completion }
    }

    const existing = await findTabByFileIdentity(tabsRef.value, identity)
    if (existing) {
      switchTab(existing.id)
      if (path?.toLowerCase().endsWith('.fig')) {
        watchOpenedFigCover(path, existing.store)
        void cacheOpenedFigCover(path, existing.store).catch((error) => {
          console.warn('[Recent files] Failed to cache the Cover thumbnail', error)
        })
      }
      return { kind: 'existing' as const }
    }

    const { store, created } = reusableTabStore()
    store.state.documentName = file.name.replace(/\.[^.]+$/i, '')
    const load = store.preparationController.begin({
      kind: isDOMImportFile(file) ? 'dom-import' : 'document-open',
      subject: file.name
    })

    const completion = Promise.withResolvers<undefined>()
    void completion.promise.catch(() => undefined)
    const pendingOpen = { completion: completion.promise, identity, store }
    fileOpenCoordinator.add(pendingOpen)
    return { kind: 'owner' as const, completion, pendingOpen, store, created, load }
  })

  if (decision.kind === 'existing') return
  if (decision.kind === 'pending') {
    await decision.completion
    return
  }

  const { completion, pendingOpen, store, created, load } = decision
  let succeeded = false
  try {
    if (isDOMImportFile(file)) {
      await store.openDOMFile(file, { handle, path, preparation: load })
      completion.resolve(undefined)
      succeeded = true
      return
    }

    await yieldToUI()
    load.update({ phase: 'reading', detail: file.name })
    const isFig = file.name.toLowerCase().endsWith('.fig')
    let imported: SceneGraph
    let sourceFormat: string
    if (isFig) {
      load.update({ phase: 'decoding', detail: file.name })
      imported = await readFigForTab(file, load.signal)
      sourceFormat = 'fig'
    } else {
      const result = await io.readDocument({
        name: file.name,
        mimeType: file.type || undefined,
        data: new Uint8Array(await file.arrayBuffer())
      })
      imported = result.graph
      sourceFormat = result.sourceFormat
    }

    const firstPageId = imported.getPages()[0]?.id
    if (!isFig && firstPageId) computeAllLayouts(imported, firstPageId)
    await showImportedGraph(
      store,
      imported,
      () => {
        store.setDocumentSource(file.name, sourceFormat, handle, path)
        if (isFig && path) watchOpenedFigCover(path, store)
      },
      load
    )
    if (isFig && path) {
      void cacheOpenedFigCover(path, store).catch((error) => {
        console.warn('[Recent files] Failed to cache the Cover thumbnail', error)
      })
    }
    completion.resolve(undefined)
    succeeded = true
  } catch (error) {
    failPreparation(load, 'decode-failed', error)
    completion.reject(error)
    if (created) {
      const tab = getTabForStore(store)
      if (tab) await closeTab(tab.id)
    }
    throw error
  } finally {
    if (succeeded) load.complete()
    fileOpenCoordinator.remove(pendingOpen)
  }
}

export async function listRecoverySnapshots(): Promise<RecoverySnapshotMeta[]> {
  return getRecoveryStore().list()
}

export async function discardRecoverySnapshot(id: string): Promise<void> {
  await getRecoveryStore().remove(id)
}

export async function restoreRecoverySnapshot(id: string): Promise<void> {
  const snapshot = await getRecoveryStore().read(id)
  if (!snapshot) throw new Error('Recovery snapshot is no longer available')

  const { store } = reusableTabStore()
  const load = store.preparationController.begin({
    kind: 'recovery-restore',
    subject: snapshot.documentName
  })
  let succeeded = false
  try {
    load.update({ phase: 'reading', detail: snapshot.documentName })
    const fileBytes = new Uint8Array(snapshot.figBytes)
    const file = new File([fileBytes.buffer], `${snapshot.documentName}.fig`, {
      type: 'application/octet-stream'
    })
    load.update({ phase: 'decoding', detail: snapshot.documentName })
    const imported = await readFigForTab(file, load.signal)

    await showImportedGraph(
      store,
      imported,
      async () => {
        store.state.documentName = snapshot.documentName
        await store.adoptRecoverySnapshot(id, snapshot.sceneVersion)
      },
      load
    )
    succeeded = true
  } catch (error) {
    failPreparation(load, 'decode-failed', error)
    throw error
  } finally {
    if (succeeded) load.complete()
  }
}

export async function prepareForReload(): Promise<void> {
  await Promise.all(tabsRef.value.map((tab) => tab.store.persistRecoveryNow()))
}

export function tabCount(): number {
  return tabsRef.value.length
}

export function useTabsStore() {
  return {
    tabs: allTabs,
    activeTabId,
    createHomeTab,
    createDocumentInCurrentTab,
    createTab,
    leaveHome,
    switchTab,
    closeTab,
    getActiveTabId,
    getTabById,
    getTabForStore,
    getTabsSnapshot,
    openFileInNewTab,
    openStorageDocumentInNewTab,
    listRecoverySnapshots,
    restoreRecoverySnapshot,
    discardRecoverySnapshot,
    prepareForReload,
    getActiveStore,
    tabCount
  }
}
