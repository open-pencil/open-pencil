import { computed, shallowRef, triggerRef } from 'vue'

import { createDocumentGraph } from '@open-pencil/core'
import type { DocumentKind, SceneGraph } from '@open-pencil/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
import { confirmAllDocuments } from '@/app/document/close/all'
import { confirmDocumentClose, holdsUnkeptEdits } from '@/app/document/close/controller'
import { requestDocumentClose } from '@/app/document/close/prompt'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import { rememberDocumentView } from '@/app/recent-files'
import { resolvedAppTheme } from '@/app/shell/theme'
import { forgetOpenedFigCover } from '@/app/tabs/open/cover'

/**
 * Home, pinned first; a New file tab, which offers what to create and the recent files, as
 * Figma's ⌘T and + do, and becomes the document picked there; or a document.
 */
export type TabKind = 'home' | 'new-file' | 'document'

export interface Tab {
  id: string
  store: EditorStore
  kind: TabKind
}

let nextTabId = 1

function generateTabId(): string {
  return `tab-${nextTabId++}`
}

const tabsRef = shallowRef<Tab[]>([])
/** The id of the tab in front, as `useTabsStore()` hands it out. */
export const activeTabId = shallowRef('')

export const activeTab = computed(() => tabsRef.value.find((t) => t.id === activeTabId.value))

/** Whether the tab in front holds a document: Home and a New file tab have none to save. */
export function showsDocument(): boolean {
  return activeTab.value?.kind === 'document'
}

export const allTabs = computed(() =>
  tabsRef.value.map((t) => ({
    id: t.id,
    name: t.store.state.documentName,
    isHome: t.kind === 'home',
    isNewFile: t.kind === 'new-file',
    isDirty: t.kind === 'document' && holdsUnkeptEdits(t.store),
    // What kind of file the tab holds, for its icon, as Home marks its files.
    fileKind: t.kind === 'document' ? t.store.state.documentKind : undefined,
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

/**
 * Opens an empty document of this kind: a design or a board. Picked in a New file tab, it takes
 * that tab's place; otherwise it gets a tab of its own.
 */
export function createDocumentTab(kind: DocumentKind): Tab {
  const picker = activeTab.value?.kind === 'new-file' ? activeTab.value : undefined
  const tab = createTab(undefined, createDocumentGraph(kind, resolvedAppTheme.value))
  if (picker) {
    const rest = tabsRef.value.filter((entry) => entry !== tab)
    tabsRef.value = rest.map((entry) => (entry === picker ? tab : entry))
    disposeTabStore(picker.store)
  }
  return tab
}

/** Opens a New file tab, as Figma's + and ⌘T do. */
export function openNewFileTab(): Tab {
  const tab: Tab = { id: generateTabId(), store: createEditorStore(), kind: 'new-file' }
  tabsRef.value = [...tabsRef.value, tab]
  activateTab(tab)
  return tab
}

/**
 * Shows Home, the one tab pinned first that never closes and never turns into a design, as in
 * Figma's desktop app; it is made the first time it is asked for.
 */
export function createHomeTab(): Tab {
  const existing = tabsRef.value.find((tab) => tab.kind === 'home')
  if (existing) {
    activateTab(existing)
    return existing
  }
  const tab: Tab = { id: generateTabId(), store: createEditorStore(), kind: 'home' }
  tabsRef.value = [tab, ...tabsRef.value]
  activateTab(tab)
  return tab
}

export function showNewTab(): void {
  createHomeTab()
}

/** `tabs` with Home first: as they are when it is, with their Home moved there, or `home()` added. */
export function withHomePinned(tabs: readonly Tab[], home: () => Tab): readonly Tab[] {
  if (tabs[0]?.kind === 'home') return tabs
  const existing = tabs.find((tab) => tab.kind === 'home')
  return existing ? [existing, ...tabs.filter((tab) => tab !== existing)] : [home(), ...tabs]
}

/** Pins Home first when it is missing, leaving the tab in front where it is. */
export function ensureHomeTab(): void {
  const pinned = withHomePinned(tabsRef.value, () => ({
    id: generateTabId(),
    store: createEditorStore(),
    kind: 'home'
  }))
  if (pinned !== tabsRef.value) tabsRef.value = [...pinned]
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

/** Activates the tab. False when no tab carries that id, so callers can tell a no-op apart. */
export function switchTab(tabId: string): boolean {
  const tab = tabsRef.value.find((t) => t.id === tabId)
  if (!tab) return false
  activateTab(tab)
  return true
}

/**
 * Activates the tab `step` places from the one in front, wrapping around the ends, as Figma's
 * ⌃Tab and ⌃⇧Tab do; Home counts, so the tab after the last is Home.
 */
export function switchAdjacentTab(step: 1 | -1): void {
  const tabs = tabsRef.value
  if (tabs.length < 2) return
  const index = tabs.findIndex((tab) => tab.id === activeTabId.value)
  activateTab(tabs[(index + step + tabs.length) % tabs.length])
}

function disposeTabStore(store: EditorStore): void {
  forgetOpenedFigCover(store)
  store.preparationController.dispose()
  store.dispose()
}

/**
 * Close a tab, asking whether to save unsaved changes. Pass `unsaved` to decide without
 * asking, as automation must: nobody may be there to answer.
 */
export async function closeTab(tabId: string, unsaved?: 'save' | 'discard'): Promise<void> {
  const idx = tabsRef.value.findIndex((t) => t.id === tabId)
  if (idx === -1) return

  const closingTab = tabsRef.value[idx]
  if (closingTab.kind === 'home') return
  // A New file tab holds no document to save or recover.
  if (closingTab.kind === 'new-file') {
    removeTab(closingTab)
    return
  }
  const choice = unsaved
    ? await confirmDocumentClose(closingTab.store, async () => unsaved)
    : await requestDocumentClose(closingTab.store, closingTab.store.state.documentName)
  if (choice === 'cancel') return
  if (choice === 'discard') await closingTab.store.discardRecovery()
  else await closingTab.store.persistRecoveryNow()
  if (!tabsRef.value.includes(closingTab)) return
  if (choice !== 'discard' && holdsUnkeptEdits(closingTab.store)) return
  rememberDocumentView(closingTab.store)
  removeTab(closingTab)
}

/**
 * Takes a tab out of the window and disposes its store, showing a neighbour or a new Home. For the
 * tabs domain's own flows, such as an open that failed; others close tabs with `closeTab`.
 */
export function removeTab(closingTab: Tab): void {
  const idx = tabsRef.value.indexOf(closingTab)
  if (idx === -1) return
  const wasActive = activeTabId.value === closingTab.id
  disposeTabStore(closingTab.store)
  tabsRef.value = tabsRef.value.filter((t) => t !== closingTab)

  if (tabsRef.value.length === 0) {
    createHomeTab()
    return
  }

  if (wasActive) {
    const newIdx = Math.min(idx, tabsRef.value.length - 1)
    activateTab(tabsRef.value[newIdx])
  }
}

/** The recovery copies of the documents open in tabs, which belong to those tabs while open. */
export function openRecoveryIds(): Set<string> {
  return new Set(
    tabsRef.value.filter((tab) => tab.kind === 'document').map((tab) => tab.store.getRecoveryId())
  )
}

function documentStores(): EditorStore[] {
  return tabsRef.value.filter((tab) => tab.kind === 'document').map((tab) => tab.store)
}

export async function prepareForClose(): Promise<boolean> {
  const closing = await confirmAllDocuments(documentStores)
  if (closing) documentStores().forEach(rememberDocumentView)
  return closing
}

export async function prepareForReload(): Promise<void> {
  documentStores().forEach(rememberDocumentView)
  await Promise.all(tabsRef.value.map((tab) => tab.store.persistRecoveryNow()))
}

export function tabCount(): number {
  return tabsRef.value.length
}
