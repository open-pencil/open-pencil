import { shallowRef, computed, triggerRef } from 'vue'

import { documentKindForSourceFormat, documentKindRules } from '@open-pencil/core/editor'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { createEmptyDeckGraph } from '@open-pencil/deck'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
import type { DocumentSourceIdentity } from '@/app/document/io/types'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  type StorageDocument
} from '@/app/integrations/storage'
import { getLocalCanvasStore } from '@/app/storage/local-store'
import { seedStorageCanvasFromRemote } from '@/app/storage/sync/persist'
import { currentTargetIdFor } from '@/app/storage/target'
import { createFileOpenCoordinator } from '@/app/tabs/open/coordinator'
import { findTabByFileIdentity } from '@/app/tabs/open/identity'

export interface Tab {
  id: string
  store: EditorStore
  /**
   * A blank tab the user has not put anything into yet, safe to recycle.
   *
   * Set at creation rather than inferred. The previous test was
   * `name === 'Untitled' && !undo.canUndo`, and `!canUndo` means "not edited
   * THIS SESSION", not "empty" — so a stored document opened and left untouched
   * satisfied it, and New Design adopted that document's graph and saved it
   * under a fresh id. No heuristic over document properties can be audited,
   * and each new property silently changes what it means.
   */
  scratch: boolean
}

const io = new IORegistry(BUILTIN_IO_FORMATS)
const fileOpenCoordinator = createFileOpenCoordinator()

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
    // What the tab actually holds. A generic page glyph made a deck and a
    // design indistinguishable in the strip, which is where you look to tell
    // them apart.
    format: documentKindRules(t.store.state.documentKind).saveFormat,
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

/**
 * Land pending edits in every open tab before another surface reads saved
 * state. The workspace grid renders thumbnails from the last persisted bytes;
 * without this, a colour change made seconds before navigating away still
 * shows the old stage on the card.
 */
export async function flushOpenTabSaves(): Promise<void> {
  // Optional call: a dev-server HMR can leave stores created before this
  // action existed, and the workspace must not crash listing documents on
  // their account.
  await Promise.all(tabsRef.value.map((tab) => tab.store.flushPendingSave?.()))
}

export function createTab(store?: EditorStore, initialGraph?: SceneGraph): Tab {
  const s = store ?? createEditorStore(initialGraph)
  // Only a genuinely blank tab is scratch. One seeded with a graph already
  // holds content, whoever produced it.
  const tab: Tab = { id: generateTabId(), store: s, scratch: !store && !initialGraph }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
  return tab
}

/**
 * New Figma Slides document: dark chrome, one white 1920×1080 slide, starter title.
 * Save path defaults to `.deck`.
 */
export async function createDeckTab(): Promise<Tab> {
  const graph = createEmptyDeckGraph()
  const pageId = graph.getPages()[0]?.id
  if (pageId) computeAllLayouts(graph, pageId)

  const tab = createTab(undefined, graph)
  const { store } = tab
  tab.scratch = false
  store.state.documentName = 'Untitled'
  store.setDocumentKind('deck')
  store.setDocumentSource('Untitled.deck', 'deck')
  store.clearSelection()
  store.undo.clear()

  const currentPageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
  await store.switchPage(currentPageId)
  await store.fitCurrentPageToViewport()
  return tab
}

function activateTab(tab: Tab) {
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

export function closeTab(tabId: string) {
  const idx = tabsRef.value.findIndex((t) => t.id === tabId)
  if (idx === -1) return

  const closingTab = tabsRef.value[idx]
  const wasActive = activeTabId.value === tabId
  tabsRef.value = tabsRef.value.filter((t) => t.id !== tabId)

  if (tabsRef.value.length === 0) {
    createTab()
    closingTab.store.dispose()
    return
  }

  if (wasActive) {
    const newIdx = Math.min(idx, tabsRef.value.length - 1)
    activateTab(tabsRef.value[newIdx])
  }

  closingTab.store.dispose()
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function isDOMImportFile(file: File): boolean {
  return /\.(html?|xhtml)$/i.test(file.name)
}

/** Consume the active tab only if it is still the blank one it was created as. */
function reusableTabStore(): EditorStore {
  const current = activeTab.value
  if (!current?.scratch) return createTab().store
  current.scratch = false
  return current.store
}

function findStorageTab(providerId: string, documentId: string): Tab | undefined {
  return tabsRef.value.find((tab) => {
    const binding = tab.store.getStorageBinding()
    return binding?.providerId === providerId && binding.documentId === documentId
  })
}

export async function openStorageDocumentInNewTab(document: StorageDocument): Promise<void> {
  const providerId = activeStorageProviderID.value
  const existing = findStorageTab(providerId, document.id)
  if (existing) {
    switchTab(existing.id)
    return
  }

  // Workspace documents append to the editor tab list and stay focused. Reusing an
  // untouched tab could replace a tab in the middle of the strip, which made cloud opens
  // appear to land in an arbitrary position.
  const tab = createTab()
  const { store } = tab
  store.state.documentName = document.name
  store.state.loading = true
  try {
    const local = getLocalCanvasStore()
    const localMetadata = await local.getMeta(document.id)
    const localBytes = localMetadata?.hasFig ? await local.readFig(document.id) : null
    const localIsAuthoritative =
      localMetadata?.syncStatus !== 'synced' ||
      !document.metadataAuthoritative ||
      localMetadata.updatedAt >= document.updatedAt
    let bytes = localBytes && localIsAuthoritative ? localBytes : null

    if (!bytes) {
      bytes = await createActiveStorageAdapter(providerId).getDocument(document.id)
      await seedStorageCanvasFromRemote({
        syncTargetId: currentTargetIdFor(providerId),
        canvasId: document.id,
        name: document.name,
        sourceFormat: document.sourceFormat,
        trashedAt: document.trashedAt,
        updatedAt: document.updatedAt,
        figBytes: bytes
      })
    }

    // The eviction LRU key. Nothing wrote it before, so the cache evicted
    // least-recently-WRITTEN — an untouched document that autosaved once
    // outranked one the user opens daily.
    await local.updateMeta(document.id, { lastOpenedAt: new Date().toISOString() })

    const sourceFormat = localMetadata?.sourceFormat ?? document.sourceFormat
    const fileBytes = new Uint8Array(bytes.byteLength)
    fileBytes.set(bytes)
    const file = new File([fileBytes.buffer], `${document.name}.${sourceFormat}`, {
      type: 'application/octet-stream'
    })
    const imported =
      sourceFormat === 'fig'
        ? await readFigFile(file, { populate: 'first-page' })
        : (
            await io.readDocument({
              name: file.name,
              mimeType: file.type,
              data: fileBytes
            })
          ).graph
    const firstPageId = imported.getPages()[0]?.id
    if (firstPageId) computeAllLayouts(imported, firstPageId)
    store.replaceGraph(imported)
    store.undo.clear()
    store.setDocumentKind(documentKindForSourceFormat(sourceFormat))
    store.setStorageDocumentSource(
      { providerId, documentId: document.id },
      document.name,
      sourceFormat
    )
    store.clearSelection()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    await store.fitCurrentPageToViewport()
    switchTab(tab.id)
  } finally {
    store.state.loading = false
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
      return { kind: 'existing' as const }
    }

    const store = reusableTabStore()
    store.state.documentName = file.name.replace(/\.[^.]+$/i, '')
    store.state.loading = true

    const completion = Promise.withResolvers<undefined>()
    void completion.promise.catch(() => undefined)
    const pendingOpen = { completion: completion.promise, identity, store }
    fileOpenCoordinator.add(pendingOpen)
    return { kind: 'owner' as const, completion, pendingOpen, store }
  })

  if (decision.kind === 'existing') return
  if (decision.kind === 'pending') {
    await decision.completion
    return
  }

  const { completion, pendingOpen, store } = decision
  try {
    if (isDOMImportFile(file)) {
      await store.openDOMFile(file, { handle, path })
      completion.resolve(undefined)
      return
    }

    await yieldToUI()
    const isFig = file.name.toLowerCase().endsWith('.fig')
    const { graph: imported, sourceFormat } = isFig
      ? { graph: await readFigFile(file, { populate: 'first-page' }), sourceFormat: 'fig' }
      : await io.readDocument({
          name: file.name,
          mimeType: file.type || undefined,
          data: new Uint8Array(await file.arrayBuffer())
        })

    const firstPageId = imported.getPages()[0]?.id
    if (firstPageId) computeAllLayouts(imported, firstPageId)
    store.replaceGraph(imported)
    store.undo.clear()
    store.setDocumentSource(file.name, sourceFormat, handle, path)
    store.setDocumentKind(documentKindForSourceFormat(sourceFormat))
    store.clearSelection()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    // Fit whole slide (1920×1080 artboard) once canvas size is known
    await store.fitCurrentPageToViewport()
    completion.resolve(undefined)
  } catch (error) {
    completion.reject(error)
    throw error
  } finally {
    store.state.loading = false
    fileOpenCoordinator.remove(pendingOpen)
  }
}

export function tabCount(): number {
  return tabsRef.value.length
}

export function useTabsStore() {
  return {
    tabs: allTabs,
    activeTabId,
    createTab,
    createDeckTab,
    switchTab,
    closeTab,
    getActiveTabId,
    getTabById,
    getTabForStore,
    getTabsSnapshot,
    openFileInNewTab,
    openStorageDocumentInNewTab,
    getActiveStore,
    tabCount
  }
}
