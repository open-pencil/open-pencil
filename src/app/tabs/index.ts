import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@inkly/core/io'
import { readFigFile } from '@inkly/core/io/formats/fig'
import { computeAllLayouts } from '@inkly/core/layout'
import type { SceneGraph, SceneNode } from '@inkly/core/scene-graph'
import { fetchIcons } from '@inkly/core/icons'
import { fontManager } from '@inkly/core/text/fonts'

import { setInklyStore } from '@/app/browser-bridge'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'

export interface Tab {
  id: string
  store: EditorStore
}

const io = new IORegistry(BUILTIN_IO_FORMATS)

function weightToStyleName(weight: number): string {
  if (weight <= 100) return 'Thin'
  if (weight <= 200) return 'ExtraLight'
  if (weight <= 300) return 'Light'
  if (weight <= 400) return 'Regular'
  if (weight <= 500) return 'Medium'
  if (weight <= 600) return 'SemiBold'
  if (weight <= 700) return 'Bold'
  if (weight <= 800) return 'ExtraBold'
  return 'Black'
}

function collectExtraFontStyles(graph: SceneGraph): Array<[string, string]> {
  const seen = new Set<string>()
  const result: Array<[string, string]> = []

  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT') continue
    const family = node.fontFamily
    if (!family || family === 'lucide' || family === 'Material Symbols Sharp') continue
    const style = weightToStyleName(node.fontWeight ?? 400)
    const key = `${family}|${style}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push([family, style])
  }

  const defaultFonts: Array<[string, string[]]> = [
    ['Noto Sans JP', ['Regular', 'Bold']],
    ['Inter', ['Regular', 'Medium', 'SemiBold', 'Bold']],
  ]
  for (const [f, styles] of defaultFonts) {
    for (const s of styles) {
      const key = `${f}|${s}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push([f, s])
      }
    }
  }

  return result
}

const ICON_FAMILY_MAP: Record<string, string> = {
  lucide: 'lucide',
  feather: 'feather',
  'material symbols sharp': 'material-symbols',
  'material symbols': 'material-symbols',
  phosphor: 'ph'
}

// Icon fonts (lucide, Material Symbols, etc.) are bundled in /public.
// fontManager.loadFont automatically picks them up via BUNDLED_FONTS in fonts.ts.

async function resolveIconFontNodes(graph: SceneGraph): Promise<void> {
  const iconNodes: Array<{ node: SceneNode; prefix: string; iconName: string }> = []
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT' || !node.text) continue
    const family = node.fontFamily?.toLowerCase() ?? ''
    const prefix = ICON_FAMILY_MAP[family]
    if (!prefix) continue
    iconNodes.push({ node, prefix, iconName: node.text })
  }
  if (iconNodes.length === 0) return

  const names = [...new Set(iconNodes.map((i) => `${i.prefix}:${i.iconName}`))]
  const icons = await fetchIcons(names).catch(() => new Map())

  for (const { node, prefix, iconName } of iconNodes) {
    const data = icons.get(`${prefix}:${iconName}`)
    if (!data || data.paths.length === 0) continue
    const path = data.paths[0]
    node.vectorNetwork = path.vectorNetwork
    ;(node as any).type = 'VECTOR'
    node.text = ''
    const fillColor = node.fills[0]?.color
    if (path.stroke && !path.fill) {
      node.strokes = [{
        visible: true,
        color: fillColor ?? { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        weight: path.strokeWidth || 1.5,
        align: 'CENTER',
        dashPattern: []
      }]
      node.fills = []
    }
  }
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
  setInklyStore(tab.store)
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
  path?: string,
  options?: { skipPersistCache?: boolean }
): Promise<void> {
  const current = activeTab.value
  const isUntouched =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
  const store = isUntouched ? current.store : createTab().store
  const documentName = file.name.replace(/\.[^.]+$/i, '')

  store.state.documentName = documentName
  store.state.loading = true
  await yieldToUI()

  // Persist a copy of the freshly-loaded document so a page reload can
  // restore the same scene without forcing the user to drag the file back in.
  // We skip this when the file itself was just restored from cache to avoid
  // a redundant round-trip back into IndexedDB.
  if (!options?.skipPersistCache) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { savePenToCache } = await import('@/app/document/io/pen-cache')
      void savePenToCache(file.name, file.type || 'application/octet-stream', bytes)
    } catch (err) {
      console.warn('[tabs] failed to persist document cache:', err)
    }
  }

  try {
    const isFig = file.name.toLowerCase().endsWith('.fig')
    const { graph: imported, sourceFormat } = isFig
      ? { graph: await readFigFile(file, { populate: 'first-page' }), sourceFormat: 'fig' }
      : await io.readDocument({
          name: file.name,
          mimeType: file.type || undefined,
          data: new Uint8Array(await file.arrayBuffer())
        })

    // Trigger CJK fallback EARLY (before any awaits that may block on CanvasKit)
    const cjkPromise = fontManager.ensureCJKFallback().catch(() => [])

    const firstPageId = imported.getPages()[0]?.id
    if (firstPageId) computeAllLayouts(imported, firstPageId)
    store.replaceGraph(imported)
    store.undo.clear()
    store.setDocumentSource(file.name, sourceFormat, handle, path)
    store.clearSelection()

    const allNodeIds = imported.getPages().flatMap((p) => p.childIds)
    const extraFonts = collectExtraFontStyles(imported)

    const fontPromise = Promise.all([
      cjkPromise,
      store.loadFontsForNodes(allNodeIds).catch(() => []),
      ...extraFonts.map(([f, s]) => fontManager.loadFont(f, s).catch(() => null)),
      // lucide icon font (bundled in /public)
      fontManager.loadFont('lucide', 'Regular').catch(() => null),
    ])
    fontPromise.then(() => {
      const pid = store.graph.getPages()[0]?.id ?? store.graph.rootId
      computeAllLayouts(store.graph, pid)
      store.requestRender()
    })
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    await store.fitCurrentPageToViewport()
  } finally {
    store.state.loading = false
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
