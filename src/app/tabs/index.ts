import { shallowRef, computed, triggerRef } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { exportFigFile, readFigFile } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { setOpenPencilStore } from '@/app/browser-bridge'
import { requireActiveCloudAdapter } from '@/app/cloud/active'
import { setCloudActivity } from '@/app/cloud/activity'
import { isCloudConfigured } from '@/app/cloud/credentials'
import { formatCloudBytes } from '@/app/cloud/format-bytes'
import { createCanvasId } from '@/app/cloud/id'
import { getLocalCanvasStore } from '@/app/cloud/local-store'
import { kickSyncEngine } from '@/app/cloud/sync'
import { persistCloudCanvasLocally, seedLocalCanvasFromRemote } from '@/app/cloud/sync/persist'
import {
  encodeThumbnailJpeg,
  extractFigThumbnailPng,
  renderBlankCanvasThumbnailJpeg,
  renderGraphThumbnailPng
} from '@/app/cloud/thumbnail'
import type { CloudStorageAdapter } from '@/app/cloud/types'
import { nextUniqueCloudName } from '@/app/cloud/unique-name'
import { validateDesignImportBytes } from '@/app/cloud/validate-import'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session'
import type { EditorStore } from '@/app/editor/session'
import { toast } from '@/app/shell/ui'

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
    closingTab.store.dispose()
    if (isCloudConfigured.value) {
      // Prefer Files home over a local-only blank tab when cloud is the entry.
      void import('@/router').then((m) => m.default.push('/'))
      return
    }
    createTab()
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

export async function openFileInNewTab(
  file: File,
  handle?: FileSystemFileHandle,
  path?: string
): Promise<void> {
  const current = activeTab.value
  const isUntouched =
    current?.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
  const store = isUntouched ? current.store : createTab().store
  if (isDOMImportFile(file)) {
    await store.openDOMFile(file, { handle, path })
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
  } finally {
    store.state.loading = false
  }
}

export function tabCount(): number {
  return tabsRef.value.length
}

function pickStoreForOpen(): EditorStore {
  const current = activeTab.value
  if (!current) return createTab().store
  const isUntouched = current.store.state.documentName === 'Untitled' && !current.store.undo.canUndo
  return isUntouched ? current.store : createTab().store
}

/**
 * If this canvas has no local thumb yet, generate one after the editor surface
 * is ready and enqueue a remote put.
 */
async function ensureCloudThumbnailAfterOpen(
  canvasId: string,
  store: EditorStore,
  figBytes: Uint8Array
): Promise<void> {
  const local = getLocalCanvasStore()
  try {
    const existing = await local.readThumb(canvasId)
    if (existing && existing.byteLength >= 256) return
  } catch (error) {
    console.warn('[Cloud] readThumb probe failed:', error)
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    if (store.renderer?.ck) break
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }

  try {
    // Prefer the embedded fig thumbnail: it was rendered from finished content,
    // while a live render this early can capture a not-yet-painted (blank) page.
    const png =
      extractFigThumbnailPng(figBytes) ??
      renderGraphThumbnailPng({
        graph: store.graph,
        pageId: store.state.currentPageId,
        renderer: store.renderer,
        ck: store.renderer?.ck
      })
    let jpeg: Uint8Array | null = null
    if (png && png.byteLength >= 256) jpeg = await encodeThumbnailJpeg(png)
    else jpeg = await renderBlankCanvasThumbnailJpeg()
    if (!jpeg) return
    const meta = await local.writeThumb(canvasId, jpeg)
    if (meta) {
      const { enqueuePutThumb } = await import('@/app/cloud/sync')
      await enqueuePutThumb(canvasId, meta.revision)
      void kickSyncEngine()
    }
  } catch (error) {
    console.warn('[Cloud] Thumbnail backfill failed:', error)
  }
}

/**
 * Regenerate the card preview from the live canvas and sync it. Called when
 * leaving the editor — content is fully painted by then, so this also heals
 * stale blank thumbnails from earlier races.
 */
export async function refreshCloudThumbnail(canvasId: string, store: EditorStore): Promise<void> {
  try {
    const png = renderGraphThumbnailPng({
      graph: store.graph,
      pageId: store.state.currentPageId,
      renderer: store.renderer,
      ck: store.renderer?.ck
    })
    if (!png || png.byteLength < 256) return
    const jpeg = await encodeThumbnailJpeg(png)
    const meta = await getLocalCanvasStore().writeThumb(canvasId, jpeg)
    if (meta) {
      const { enqueuePutThumb } = await import('@/app/cloud/sync')
      await enqueuePutThumb(canvasId, meta.revision)
      void kickSyncEngine()
    }
  } catch (error) {
    console.warn('[Cloud] Thumbnail refresh failed:', error)
  }
}

function createDownloadActivityReporter() {
  let lastShownPercent = -1
  return ({ receivedBytes, totalBytes }: { receivedBytes: number; totalBytes: number | null }) => {
    if (totalBytes) {
      const percent = Math.floor((receivedBytes / totalBytes) * 100)
      if (percent === lastShownPercent) return
      lastShownPercent = percent
      setCloudActivity(
        `Downloading file from cloud… ${percent}% of ${formatCloudBytes(totalBytes)}`
      )
    } else {
      setCloudActivity(`Downloading file from cloud… ${formatCloudBytes(receivedBytes)}`)
    }
  }
}

/** LRU bookkeeping + keep the fig cache within budget (never evicts
 * unsynced content or canvases open in a tab). */
async function trackOpenAndEvictCache(canvasId: string): Promise<void> {
  try {
    await getLocalCanvasStore().updateMeta(canvasId, { lastOpenedAt: new Date().toISOString() })
    const openIds = new Set<string>()
    for (const tab of getTabsSnapshot()) {
      const binding = tab.store.getCloudBinding()
      if (binding?.canvasId) openIds.add(binding.canvasId)
    }
    const { evictLocalFigCache } = await import('@/app/cloud/cache-eviction')
    await evictLocalFigCache(openIds)
  } catch (e) {
    console.warn('[Cloud] cache eviction failed:', e)
  }
}

/** Download a canvas from the cloud (with progress) and seed the local cache. */
async function downloadAndSeedCanvas(
  adapter: CloudStorageAdapter,
  canvasId: string,
  fallbackName: string
): Promise<{ bytes: Uint8Array; name: string }> {
  setCloudActivity('Downloading file from cloud…')
  const bytes = await adapter.getCanvas(canvasId, createDownloadActivityReporter())
  let name = fallbackName
  try {
    const listed = await adapter.listCanvases()
    const match = listed.find((c) => c.id === canvasId)
    if (match?.name) name = match.name
    let thumb: Uint8Array | null = null
    try {
      thumb = (await adapter.getThumbnail?.(canvasId)) ?? null
    } catch {
      thumb = null
    }
    await seedLocalCanvasFromRemote({
      providerId: adapter.id,
      canvasId,
      name,
      updatedAt: match?.updatedAt ?? new Date().toISOString(),
      figBytes: bytes,
      thumbBytes: thumb,
      markSynced: true
    })
  } catch (e) {
    console.warn('[Cloud] seed local after download failed:', e)
  }
  return { bytes, name }
}

/** Open a cloud canvas into a tab (local cache first, then remote). */
export async function openCloudCanvasInTab(canvasId: string): Promise<void> {
  const adapter = requireActiveCloudAdapter()
  const store = pickStoreForOpen()
  store.state.loading = true
  setCloudActivity('Opening file…')
  await yieldToUI()

  try {
    const local = getLocalCanvasStore()
    const localMeta = await local.getMeta(canvasId)
    let bytes =
      localMeta && !localMeta.tombstoned && localMeta.hasFig ? await local.readFig(canvasId) : null
    if (bytes?.byteLength === 0) bytes = null
    let name = localMeta?.name ?? canvasId

    if (!bytes) {
      const downloaded = await downloadAndSeedCanvas(adapter, canvasId, name)
      bytes = downloaded.bytes
      name = downloaded.name
    }

    setCloudActivity('Opening file…')
    const file = new File([new Uint8Array(bytes)], `${canvasId}.fig`, {
      type: 'application/octet-stream'
    })
    const imported = await readFigFile(file, { populate: 'first-page' })
    const firstPageId = imported.getPages()[0]?.id
    if (firstPageId) computeAllLayouts(imported, firstPageId)
    store.replaceGraph(imported)
    store.undo.clear()

    store.setCloudDocumentSource({ providerId: adapter.id, canvasId }, name)
    store.clearSelection()
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    await store.fitCurrentPageToViewport()

    void ensureCloudThumbnailAfterOpen(canvasId, store, bytes)

    void trackOpenAndEvictCache(canvasId)
  } catch (error) {
    console.error('Failed to open cloud canvas:', error)
    toast.error(`Failed to open canvas: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  } finally {
    store.state.loading = false
    setCloudActivity(null)
  }
}

function documentNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/i, '').trim()
  return base || 'Untitled'
}

function isImportableDesignFile(file: File): boolean {
  const n = file.name.toLowerCase()
  return n.endsWith('.fig') || n.endsWith('.pen')
}

/** Names already in use (local cache + remote listing) for unique-name picking. */
async function collectTakenCloudNames(adapter: CloudStorageAdapter): Promise<string[]> {
  const localMetas = await getLocalCanvasStore().listMetas()
  let remoteNames: string[] = []
  try {
    remoteNames = (await adapter.listCanvases()).map((c) => c.name)
  } catch {
    remoteNames = []
  }
  return [...localMetas.map((m) => m.name), ...remoteNames]
}

export type CloudImportProgress = {
  current: number
  total: number
  fileName: string
  phase: 'reading' | 'converting' | 'uploading'
  /** Byte size of the payload being uploaded (when known). */
  byteLength?: number
}

/**
 * Import local design files (local-first). .fig stored as-is; .pen converted first.
 * Remote upload is enqueued and runs in the background.
 */
export async function importLocalFilesToCloud(
  files: File[],
  onProgress?: (progress: CloudImportProgress) => void
): Promise<string[]> {
  const adapter = requireActiveCloudAdapter()
  // Best-effort namespace; import still works offline into local store.
  try {
    await adapter.ensureNamespace()
  } catch (e) {
    console.warn('[Cloud] ensureNamespace during import failed (will sync later):', e)
  }

  const importable = files.filter(isImportableDesignFile)
  if (importable.length === 0) {
    toast.error('Drop .fig or .pen files to import')
    return []
  }

  const ids: string[] = []
  const total = importable.length
  const takenNames = new Set(await collectTakenCloudNames(adapter))

  async function report(progress: CloudImportProgress) {
    onProgress?.(progress)
    const label = progress.total > 1 ? `(${progress.current}/${progress.total}) ` : ''
    let phaseLabel = 'Saving'
    if (progress.phase === 'converting') phaseLabel = 'Converting'
    else if (progress.phase === 'reading') phaseLabel = 'Reading'
    setCloudActivity(`${label}${phaseLabel} ${progress.fileName}…`)
    await yieldToUI()
    await yieldToUI()
  }

  try {
    for (let i = 0; i < importable.length; i++) {
      const file = importable[i]
      const current = i + 1

      await report({ current, total, fileName: file.name, phase: 'reading' })

      const canvasId = createCanvasId()
      const name = nextUniqueCloudName(documentNameFromFileName(file.name), takenNames)
      takenNames.add(name)
      let bytes: Uint8Array

      const raw = new Uint8Array(await file.arrayBuffer())
      const validation = validateDesignImportBytes(file.name, raw)
      if (!validation.ok) {
        throw new Error(`${file.name}: ${validation.message}`)
      }

      if (file.name.toLowerCase().endsWith('.fig')) {
        bytes = raw
      } else {
        await report({ current, total, fileName: file.name, phase: 'converting' })
        const { graph } = await io.readDocument({
          name: file.name,
          mimeType: file.type || undefined,
          data: raw
        })
        bytes = await exportFigFile(graph)
      }

      await report({
        current,
        total,
        fileName: file.name,
        phase: 'uploading',
        byteLength: bytes.byteLength
      })
      await persistCloudCanvasLocally({
        providerId: adapter.id,
        canvasId,
        name,
        figBytes: bytes
      })
      ids.push(canvasId)
    }
    toast.info(ids.length === 1 ? `Imported ${importable[0].name}` : `Imported ${ids.length} files`)
    return ids
  } catch (error) {
    console.error('Failed to import to cloud:', error)
    toast.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  } finally {
    setCloudActivity(null)
  }
}

/** Create a blank cloud canvas (local-first), open in editor; remote sync is background. */
export async function createCloudCanvasInTab(name = 'Untitled'): Promise<string> {
  const adapter = requireActiveCloudAdapter()
  try {
    await adapter.ensureNamespace()
  } catch (e) {
    console.warn('[Cloud] ensureNamespace during create failed (will sync later):', e)
  }

  const store = pickStoreForOpen()
  const canvasId = createCanvasId()
  const uniqueName = nextUniqueCloudName(name, await collectTakenCloudNames(adapter))
  store.state.loading = true
  setCloudActivity('Creating fig…')
  await yieldToUI()

  try {
    const renderer = store.renderer ?? undefined
    const bytes = await exportFigFile(
      store.graph,
      renderer?.ck,
      renderer,
      store.state.currentPageId
    )
    await persistCloudCanvasLocally({
      providerId: adapter.id,
      canvasId,
      name: uniqueName,
      figBytes: bytes,
      editor: store,
      pageId: store.state.currentPageId
    })
    store.setCloudDocumentSource({ providerId: adapter.id, canvasId }, uniqueName)
    store.clearSelection()
    await store.fitCurrentPageToViewport()
    return canvasId
  } catch (error) {
    console.error('Failed to create cloud canvas:', error)
    toast.error(
      `Failed to create canvas: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error
  } finally {
    store.state.loading = false
    setCloudActivity(null)
  }
}

/**
 * File → New / new-tab shortcut.
 * Cloud configured → create a cloud canvas and open it; otherwise a local blank tab.
 */
export async function createNewDocument(name = 'Untitled'): Promise<void> {
  if (isCloudConfigured.value) {
    const id = await createCloudCanvasInTab(name)
    const router = (await import('@/router')).default
    await router.push(`/edit/cloud/${id}`)
    return
  }
  createTab()
}

export function useTabsStore() {
  return {
    tabs: allTabs,
    activeTabId,
    createTab,
    createNewDocument,
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
