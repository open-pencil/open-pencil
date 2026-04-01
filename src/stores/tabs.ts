import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'

import { createEditorStore, setActiveEditorStore } from './editor'

import type { EditorStore } from './editor'
import type { SceneGraph } from '@open-pencil/core'

export interface Tab {
  id: string
  store: EditorStore
}

const io = new IORegistry(BUILTIN_IO_FORMATS)

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
  window.__OPEN_PENCIL_STORE__ = tab.store
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

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  const current = activeTab.value
  const isUntouched =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { graph: imported, sourceFormat } = await io.readDocument({
    name: file.name,
    mimeType: file.type || undefined,
    data: bytes
  })
  const documentName = file.name.replace(/\.[^.]+$/i, '')

  if (isUntouched) {
    current.store.replaceGraph(imported)
    current.store.undo.clear()
    current.store.state.documentName = documentName
    current.store.setDocumentSource(file.name, sourceFormat, handle, path)
    current.store.state.selectedIds = new Set()
    const pageId = current.store.graph.getPages()[0]?.id ?? current.store.graph.rootId
    await current.store.switchPage(pageId)
  } else {
    const store = createEditorStore(imported)
    createTab(store)
    store.undo.clear()
    store.state.documentName = documentName
    store.setDocumentSource(file.name, sourceFormat, handle, path)
    store.state.selectedIds = new Set()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
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
    openFileInNewTab,
    getActiveStore,
    tabCount
  }
}
