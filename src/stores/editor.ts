import { useDebounceFn } from '@vueuse/core'
import { shallowReactive, shallowRef, computed, watch } from 'vue'

import { IS_TAURI, CANVAS_BG_COLOR } from '@/constants'
import { loadFont } from '@/engine/fonts'
import { toast } from '@/utils/toast'
import {
  computeAllLayouts,
  createDefaultEditorState,
  createEditor,
  exportFigFile,
  readFigFile,
  renderNodesToImage,
  renderNodesToSVG,
  SceneGraph
} from '@open-pencil/core'

import type { EditorState, ExportFormat, SceneNode } from '@open-pencil/core'

export type { Tool } from '@open-pencil/core'
export type { EditorToolDef as ToolDef } from '@open-pencil/core'
export { EDITOR_TOOLS as TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core'

export function createEditorStore() {
  const graph = new SceneGraph()

  const state = shallowReactive<
    EditorState & {
      showUI: boolean
      activeRibbonTab: 'panels' | 'code' | 'ai'
      panelMode: 'layers' | 'design'
      actionToast: string | null
      mobileDrawerSnap: 'closed' | 'half' | 'full'
      clipboardHtml: string
      autosaveEnabled: boolean
      cursorCanvasX: number | null
      cursorCanvasY: number | null
    }
  >({
    ...createDefaultEditorState(graph.getPages()[0].id),
    showUI: true,
    activeRibbonTab: 'panels',
    panelMode: 'design',
    actionToast: null,
    mobileDrawerSnap: 'closed',
    clipboardHtml: '',
    autosaveEnabled: false,
    cursorCanvasX: null,
    cursorCanvasY: null
  })

  const editor = createEditor({ graph, state, loadFont })

  // ─── Vue computed refs ────────────────────────────────────────

  const selectedNodes = computed(() => {
    void state.sceneVersion
    return editor.getSelectedNodes()
  })

  const selectedNode = computed(() =>
    selectedNodes.value.length === 1 ? selectedNodes.value[0] : undefined
  )

  const layerTree = computed(() => {
    void state.sceneVersion
    return editor.getLayerTree()
  })

  // ─── File I/O state ───────────────────────────────────────────

  let fileHandle: FileSystemFileHandle | null = null
  let filePath: string | null = null
  let downloadName: string | null = null
  let savedVersion = 0
  let lastWriteTime = 0
  let unwatchFile: (() => void) | null = null

  const AUTOSAVE_DELAY = 3000

  const debouncedAutosave = useDebounceFn(async () => {
    if (state.sceneVersion === savedVersion) return
    if (!state.autosaveEnabled) return
    try {
      await writeFile(await buildFigFile())
    } catch (e) {
      console.warn('Autosave failed:', e)
    }
  }, AUTOSAVE_DELAY)

  watch(
    () => state.sceneVersion,
    (version) => {
      if (version === savedVersion) return
      if (!state.autosaveEnabled) return
      if (!fileHandle && !filePath) return
      void debouncedAutosave()
    }
  )

  // ─── Flash nodes (renderer-specific) ─────────────────────────

  let flashRafId = 0
  function flashNodes(nodeIds: string[]) {
    const renderer = editor.renderer
    if (!renderer) return
    for (const id of nodeIds) renderer.flashNode(id)
    if (!flashRafId) pumpFlashes()
  }

  function aiMarkActive(nodeIds: string[]) {
    if (!editor.renderer) return
    editor.renderer.aiMarkActive(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiMarkDone(nodeIds: string[]) {
    if (!editor.renderer) return
    editor.renderer.aiMarkDone(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiFlashDone(nodeIds: string[]) {
    if (!editor.renderer) return
    editor.renderer.aiFlashDone(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiClearAll() {
    editor.renderer?.aiClearAll()
  }

  function pumpFlashes() {
    if (!editor.renderer?.hasActiveFlashes) {
      flashRafId = 0
      return
    }
    state.renderVersion++
    flashRafId = requestAnimationFrame(pumpFlashes)
  }

  // ─── File I/O ─────────────────────────────────────────────────

  function downloadBlob(data: Uint8Array, filename: string, mime: string) {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  }

  function yieldToUI(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => r()))
  }

  async function openFigFile(file: File, handle?: FileSystemFileHandle, path?: string) {
    try {
      state.loading = true
      await yieldToUI()
      const imported = await readFigFile(file)
      await yieldToUI()
      editor.replaceGraph(imported)
      computeAllLayouts(editor.graph)
      editor.undo.clear()
      fileHandle = handle ?? null
      filePath = path ?? null
      state.documentName = file.name.replace(/\.fig$/i, '')
      downloadName = file.name
      state.selectedIds = new Set()
      const firstPage = editor.graph.getPages()[0] as SceneNode | undefined
      const pageId = firstPage?.id ?? editor.graph.rootId
      state.currentPageId = pageId
      state.panX = 0
      state.panY = 0
      state.zoom = 1
      state.pageColor = { ...CANVAS_BG_COLOR }
      await editor.loadFontsForNodes(editor.graph.getChildren(pageId).map((n) => n.id))
      editor.requestRender()
      void startWatchingFile()
    } catch (e) {
      console.error('Failed to open .fig file:', e)
      toast.show(`Failed to open file: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      state.loading = false
    }
  }

  function buildFigFile() {
    return exportFigFile(editor.graph, undefined, editor.renderer ?? undefined, state.currentPageId)
  }

  async function saveFigFile() {
    if (filePath || fileHandle) {
      await writeFile(await buildFigFile())
    } else if (downloadName) {
      downloadBlob(new Uint8Array(await buildFigFile()), downloadName, 'application/octet-stream')
    } else {
      await saveFigFileAs()
    }
  }

  async function saveFigFileAs() {
    const data = await buildFigFile()

    if (IS_TAURI) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        defaultPath: 'Untitled.fig',
        filters: [{ name: 'Figma file', extensions: ['fig'] }]
      })
      if (!path) return
      filePath = path
      fileHandle = null
      state.documentName =
        path
          .split('/')
          .pop()
          ?.replace(/\.fig$/i, '') ?? 'Untitled'
      await writeFile(data)
      void startWatchingFile()
      return
    }

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'Untitled.fig',
          types: [
            {
              description: 'Figma file',
              accept: { 'application/octet-stream': ['.fig'] }
            }
          ]
        })
        fileHandle = handle
        filePath = null
        state.documentName = handle.name.replace(/\.fig$/i, '')
        await writeFile(data)
        void startWatchingFile()
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }

    const filename = prompt('Save as:', downloadName ?? 'Untitled.fig')
    if (!filename) return
    downloadName = filename
    state.documentName = filename.replace(/\.fig$/i, '')
    downloadBlob(new Uint8Array(data), filename, 'application/octet-stream')
  }

  async function writeFile(data: Uint8Array) {
    lastWriteTime = Date.now()
    if (filePath && IS_TAURI) {
      const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
      await tauriWrite(filePath, data)
      savedVersion = state.sceneVersion
      return
    }
    if (fileHandle) {
      const writable = await fileHandle.createWritable()
      await writable.write(new Uint8Array(data))
      await writable.close()
      savedVersion = state.sceneVersion
    }
  }

  const WATCH_DEBOUNCE_MS = 1000

  async function reloadFromDisk() {
    const viewport = { panX: state.panX, panY: state.panY, zoom: state.zoom }
    const pageId = state.currentPageId

    if (filePath && IS_TAURI) {
      const { readFile: tauriRead } = await import('@tauri-apps/plugin-fs')
      const bytes = await tauriRead(filePath)
      const blob = new Blob([bytes])
      const file = new File([blob], state.documentName + '.fig')
      const imported = await readFigFile(file)
      editor.replaceGraph(imported)
      computeAllLayouts(editor.graph)
    } else if (fileHandle) {
      const file = await fileHandle.getFile()
      const imported = await readFigFile(file)
      editor.replaceGraph(imported)
      computeAllLayouts(editor.graph)
    } else {
      return
    }

    editor.undo.clear()
    savedVersion = state.sceneVersion
    state.selectedIds = new Set()
    if (editor.graph.getNode(pageId)) {
      state.currentPageId = pageId
    } else {
      state.currentPageId = editor.graph.getPages()[0]?.id ?? editor.graph.rootId
    }
    state.panX = viewport.panX
    state.panY = viewport.panY
    state.zoom = viewport.zoom
    editor.requestRender()
  }

  function stopWatchingFile() {
    if (unwatchFile) {
      unwatchFile()
      unwatchFile = null
    }
  }

  async function startWatchingFile() {
    stopWatchingFile()

    if (filePath && IS_TAURI) {
      const { watch: tauriWatch } = await import('@tauri-apps/plugin-fs')
      const path = filePath
      const unwatch = await tauriWatch(
        path,
        (event) => {
          if (typeof event.type !== 'object' || !('modify' in event.type)) return
          if (Date.now() - lastWriteTime < WATCH_DEBOUNCE_MS) return
          void reloadFromDisk()
        },
        { delayMs: 500 }
      )
      unwatchFile = () => unwatch()
    } else if (fileHandle) {
      let lastModified = (await fileHandle.getFile()).lastModified
      // oxlint-disable-next-line typescript/no-misused-promises
      const interval = setInterval(async () => {
        if (!fileHandle) {
          clearInterval(interval)
          return
        }
        try {
          const file = await fileHandle.getFile()
          if (file.lastModified > lastModified) {
            lastModified = file.lastModified
            if (Date.now() - lastWriteTime < WATCH_DEBOUNCE_MS) return
            void reloadFromDisk()
          }
        } catch {
          clearInterval(interval)
        }
      }, 2000)
      unwatchFile = () => clearInterval(interval)
    }
  }

  // ─── Export ───────────────────────────────────────────────────

  async function renderExportImage(
    nodeIds: string[],
    scale: number,
    format: ExportFormat
  ): Promise<Uint8Array | null> {
    const renderer = editor.renderer
    if (!renderer) return null
    const ids =
      nodeIds.length > 0 ? nodeIds : editor.graph.getChildren(state.currentPageId).map((n) => n.id)
    if (ids.length === 0) return null
    return renderNodesToImage(renderer.ck, renderer, editor.graph, state.currentPageId, ids, {
      scale,
      format
    })
  }

  function exportImageExtension(format: ExportFormat): string {
    switch (format) {
      case 'JPG':
        return '.jpg'
      case 'WEBP':
        return '.webp'
      default:
        return '.png'
    }
  }

  function exportImageMime(format: ExportFormat): string {
    switch (format) {
      case 'JPG':
        return 'image/jpeg'
      case 'WEBP':
        return 'image/webp'
      default:
        return 'image/png'
    }
  }

  async function exportSelection(scale: number, format: ExportFormat) {
    const ids = [...state.selectedIds]

    if (format === 'SVG') {
      const nodeIds =
        ids.length > 0 ? ids : editor.graph.getChildren(state.currentPageId).map((n) => n.id)
      const svgStr = renderNodesToSVG(editor.graph, state.currentPageId, nodeIds)
      if (!svgStr) {
        console.error('Export failed: renderNodesToSVG returned null')
        return
      }
      const svgData = new TextEncoder().encode(svgStr)
      const node = ids.length === 1 ? editor.graph.getNode(ids[0]) : undefined
      const fileName = `${node?.name ?? 'Export'}.svg`
      await saveExportedFile(svgData, fileName, 'SVG', '.svg', 'image/svg+xml')
      return
    }

    const data = await renderExportImage(ids, scale, format)
    if (!data) {
      console.error(
        `Export failed: renderExportImage returned null for format=${format} scale=${scale}`
      )
      return
    }

    const node = ids.length === 1 ? editor.graph.getNode(ids[0]) : undefined
    const baseName = node?.name ?? 'Export'
    const ext = exportImageExtension(format)
    const fileName = `${baseName}@${scale}x${ext}`
    await saveExportedFile(new Uint8Array(data), fileName, format, ext, exportImageMime(format))
  }

  async function saveExportedFile(
    data: Uint8Array,
    fileName: string,
    format: string,
    ext: string,
    mime: string
  ) {
    if (IS_TAURI) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        defaultPath: fileName,
        filters: [{ name: format, extensions: [ext.slice(1)] }]
      })
      if (!path) return
      const { writeFile: tauriWrite } = await import('@tauri-apps/plugin-fs')
      await tauriWrite(path, data)
      return
    }

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: `${format} file`,
              accept: { [mime]: [ext] }
            }
          ]
        })
        const writable = await handle.createWritable()
        await writable.write(new Uint8Array(data))
        await writable.close()
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }

    downloadBlob(data, fileName, mime)
  }

  // ─── Mobile clipboard ─────────────────────────────────────────

  function mobileCopy() {
    const transfer = new DataTransfer()
    editor.writeCopyData(transfer)
    state.clipboardHtml = transfer.getData('text/html')
  }

  function mobileCut() {
    mobileCopy()
    editor.deleteSelected()
  }

  function mobilePaste() {
    if (state.clipboardHtml) {
      editor.pasteFromHTML(state.clipboardHtml)
    }
  }

  // ─── Profiler toggle ─────────────────────────────────────────

  function toggleProfiler() {
    editor.renderer?.profiler.toggle()
    editor.requestRepaint()
  }

  // ─── Public API ───────────────────────────────────────────────
  // Spread all core Editor methods, then override getters and add app-specific.

  return {
    ...editor,
    state,
    selectedNodes,
    selectedNode,
    layerTree,

    // App-specific methods
    flashNodes,
    aiMarkActive,
    aiMarkDone,
    aiFlashDone,
    aiClearAll,
    toggleProfiler,
    openFigFile,
    saveFigFile,
    saveFigFileAs,
    renderExportImage,
    exportSelection,
    mobileCopy,
    mobileCut,
    mobilePaste
  }
}

export type EditorStore = ReturnType<typeof createEditorStore>

const storeRef = shallowRef<EditorStore>()

export function setActiveEditorStore(store: EditorStore) {
  storeRef.value = store
}

export function getActiveEditorStore(): EditorStore {
  if (!storeRef.value) throw new Error('Editor store not provided')
  return storeRef.value
}

const storeProxy = new Proxy({} as EditorStore, {
  get(_, prop) {
    return Reflect.get(getActiveEditorStore(), prop)
  }
})

export function useEditorStore(): EditorStore {
  return storeProxy
}
