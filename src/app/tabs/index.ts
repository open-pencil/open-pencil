import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
import { yieldToUI } from '@/app/document/io/browser'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import { createFileOpenLock } from '@/app/tabs/identity'

export interface Tab {
  id: string
  store: EditorStore
}

const io = new IORegistry(BUILTIN_IO_FORMATS)

const fileOpenLock = createFileOpenLock(() => tabsRef.value)

function hasSourceIdentity(store: EditorStore): boolean {
  return !!(store.getSourcePath() || store.getSourceHandle() || store.getSourceFileName())
}

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
  const tab: Tab = { id: generateTabId(), store: s }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
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

function isDOMImportFile(file: File): boolean {
  return /\.(html?|xhtml)$/i.test(file.name)
}

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  // The global lock intentionally protects only identity/tab-reuse decisions,
  // not the actual disk/network I/O. This keeps duplicate tabs impossible
  // while still allowing multiple different files to load concurrently.
  type OpenContext = { tab: Tab; isUntouched: boolean; previousDocumentName: string | undefined }

  const context = await fileOpenLock.run<OpenContext | null>(handle, path, async (existingTab) => {
    if (existingTab) {
      switchTab(existingTab.id)
      return null
    }

    // Capture the current tab only after acquiring the global open lock so
    // that the file loads into the tab the user is currently looking at.
    const current = activeTab.value
    const previousDocumentName = current?.store.state.documentName
    const isUntouched =
      current?.store.state.documentName === 'Untitled' &&
      !current.store.undo.canUndo &&
      // A tab with a redo stack is not "untouched" — overwriting it would
      // destroy recoverable user work.
      !current.store.undo.canRedo &&
      !hasSourceIdentity(current.store)

    const tab = isUntouched ? current : createTab()

    // Claim the source identity immediately so concurrent opens of the same
    // file observe a matching tab. Heavy I/O then happens after the lock.
    tab.store.updateSourceIdentity(file.name, handle, path)
    return { tab, isUntouched, previousDocumentName }
  })

  if (!context) return

  const { tab, isUntouched, previousDocumentName } = context
  const store = tab.store
  if (isDOMImportFile(file)) {
    try {
      await store.openDOMFile(file, { handle, path })
    } catch (error) {
      store.clearSourceIdentity()
      if (isUntouched && previousDocumentName !== undefined) {
        store.state.documentName = previousDocumentName
      }
      if (!isUntouched) {
        closeTab(tab.id)
      }
      throw error
    }
    if (isUntouched) {
      activateTab(tab)
    }
    return
  }
  const documentName = file.name.replace(/\.[^.]+$/i, '')

  store.state.documentName = documentName
  store.state.loading = true
  await yieldToUI()

  try {
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
    store.clearSelection()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    await store.fitCurrentPageToViewport()
  } catch (error) {
    // A failed read must not permanently taint the tab with a source identity
    // that would block future attempts to open the same file.
    store.clearSourceIdentity()
    if (isUntouched && previousDocumentName !== undefined) {
      store.state.documentName = previousDocumentName
    }
    store.state.loading = false
    if (!isUntouched) {
      closeTab(tab.id)
    }
    throw error
  }

  store.state.loading = false

  // When reusing an untouched existing tab we must explicitly activate it,
  // because the active tab may have changed while we were loading.
  if (isUntouched) {
    activateTab(tab)
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
    switchTab,
    closeTab,
    getActiveTabId,
    getTabById,
    getTabForStore,
    getTabsSnapshot,
    openFileInNewTab,
    getActiveStore,
    tabCount
  }
}
