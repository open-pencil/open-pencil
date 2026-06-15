import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/core/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
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

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  await fileOpenLock.run(handle, path, async (existingTab) => {
    if (existingTab) {
      switchTab(existingTab.id)
      return
    }

    // Capture the current tab only after acquiring the global open lock so
    // that the file loads into the tab the user is currently looking at.
    const current = activeTab.value
    const isUntouched =
      current?.store.state.documentName === 'Untitled' &&
      !current.store.undo.canUndo &&
      !hasSourceIdentity(current.store)
    const currentTab = isUntouched ? current : createTab()
    const store = currentTab.store
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
    } finally {
      store.state.loading = false
    }

    // When reusing an untouched existing tab we must explicitly activate it,
    // because the active tab may have changed while we were loading.
    if (isUntouched) {
      activateTab(currentTab)
    }
  })
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
    openFileInNewTab,
    getActiveStore,
    tabCount
  }
}
