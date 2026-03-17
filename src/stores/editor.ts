import { shallowReactive, shallowRef, computed, watch } from 'vue'

import { toast } from '@/composables/use-toast'
import {
  IS_TAURI,
  DEFAULT_SHAPE_FILL,
  DEFAULT_FRAME_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE,
  CANVAS_BG_COLOR,
  ZOOM_DIVISOR,
  ZOOM_SCALE_MIN,
  ZOOM_SCALE_MAX
} from '@/constants'
import { loadFont } from '@/engine/fonts'
import {
  collectFontKeys,
  computeLayout,
  computeAllLayouts,
  computeVectorBounds,
  exportFigFile,
  importClipboardNodes,
  parseFigmaClipboard,
  buildFigmaClipboardHTML,
  prefetchFigmaSchema,
  readFigFile,
  computeImageHash,
  renderNodesToImage,
  renderNodesToSVG,
  SceneGraph,
  setTextMeasurer,
  TextEditor,
  UndoManager
} from '@open-pencil/core'

import type {
  Color,
  ExportFormat,
  Fill,
  LayoutMode,
  NodeType,
  Rect,
  SceneNode,
  SkiaRenderer,
  SnapGuide,
  UndoEntry,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  Vector,
  VectorVertex
} from '@open-pencil/core'
import type { CanvasKit } from 'canvaskit-wasm'

export type Tool =
  | 'SELECT'
  | 'FRAME'
  | 'SECTION'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'POLYGON'
  | 'STAR'
  | 'TEXT'
  | 'PEN'
  | 'HAND'

export interface ToolDef {
  key: Tool
  label: string
  shortcut: string
  flyout?: Tool[]
}

export const TOOLS: ToolDef[] = [
  { key: 'SELECT', label: 'Move', shortcut: 'V' },
  { key: 'FRAME', label: 'Frame', shortcut: 'F', flyout: ['FRAME', 'SECTION'] },
  {
    key: 'RECTANGLE',
    label: 'Rectangle',
    shortcut: 'R',
    flyout: ['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR']
  },
  { key: 'PEN', label: 'Pen', shortcut: 'P' },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  { key: 'HAND', label: 'Hand', shortcut: 'H' }
]

export const TOOL_SHORTCUTS: Partial<Record<string, Tool>> = {
  v: 'SELECT',
  f: 'FRAME',
  s: 'SECTION',
  r: 'RECTANGLE',
  o: 'ELLIPSE',
  l: 'LINE',
  t: 'TEXT',
  p: 'PEN',
  h: 'HAND'
}

const BLACK_FILL: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}

const DEFAULT_FILLS: Record<string, Fill> = {
  FRAME: DEFAULT_FRAME_FILL,
  SECTION: SECTION_DEFAULT_FILL,
  RECTANGLE: DEFAULT_SHAPE_FILL,
  ELLIPSE: DEFAULT_SHAPE_FILL,
  POLYGON: DEFAULT_SHAPE_FILL,
  STAR: DEFAULT_SHAPE_FILL,
  LINE: BLACK_FILL,
  TEXT: BLACK_FILL
}

interface PageViewport {
  panX: number
  panY: number
  zoom: number
  pageColor: Color
}

export function createEditorStore() {
  let graph = new SceneGraph()
  const undo = new UndoManager()
  const pageViewports = new Map<string, PageViewport>()
  let fileHandle: FileSystemFileHandle | null = null
  let filePath: string | null = null
  let downloadName: string | null = null
  let savedVersion = 0
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined
  let lastWriteTime = 0
  let unwatchFile: (() => void) | null = null
  let _ck: CanvasKit | null = null
  let _renderer: SkiaRenderer | null = null
  let _textEditor: TextEditor | null = null

  void prefetchFigmaSchema()

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

  const state = shallowReactive({
    activeTool: 'SELECT' as Tool,
    currentPageId: graph.getPages()[0].id,
    selectedIds: new Set<string>(),
    marquee: null as Rect | null,
    snapGuides: [] as SnapGuide[],
    rotationPreview: null as { nodeId: string; angle: number } | null,
    dropTargetId: null as string | null,
    layoutInsertIndicator: null as {
      parentId: string
      index: number
      x: number
      y: number
      length: number
      direction: 'HORIZONTAL' | 'VERTICAL'
    } | null,
    hoveredNodeId: null as string | null,
    editingTextId: null as string | null,
    penState: null as {
      vertices: VectorVertex[]
      segments: VectorSegment[]
      dragTangent: Vector | null
      closingToFirst: boolean
    } | null,
    penCursorX: null as number | null,
    penCursorY: null as number | null,
    cursorCanvasX: null as number | null,
    cursorCanvasY: null as number | null,
    remoteCursors: [] as Array<{
      name: string
      color: Color
      x: number
      y: number
      selection?: string[]
    }>,
    showUI: true,
    documentName: 'Untitled' as string,
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR } as Color,
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    sceneVersion: 0,
    loading: false,
    activeRibbonTab: 'panels' as 'panels' | 'code' | 'ai',
    panelMode: 'design' as 'layers' | 'design',
    actionToast: null as string | null,
    mobileDrawerSnap: 'closed' as 'closed' | 'half' | 'full',
    clipboardHtml: '',
    autosaveEnabled: false,
    enteredContainerId: null as string | null
  })

  const AUTOSAVE_DELAY = 3000

  watch(
    () => state.sceneVersion,
    (version) => {
      if (version === savedVersion) return
      if (!state.autosaveEnabled) return
      if (!fileHandle && !filePath) return
      clearTimeout(autosaveTimer)
      // oxlint-disable-next-line typescript/no-misused-promises
      autosaveTimer = setTimeout(async () => {
        if (state.sceneVersion === savedVersion) return
        if (!state.autosaveEnabled) return
        try {
          await writeFile(await buildFigFile())
        } catch (e) {
          console.warn('Autosave failed:', e)
        }
      }, AUTOSAVE_DELAY)
    }
  )

  const selectedNodes = computed(() => {
    void state.sceneVersion
    const nodes: SceneNode[] = []
    for (const id of state.selectedIds) {
      const n = graph.getNode(id)
      if (n) nodes.push({ ...n })
    }
    return nodes
  })

  const selectedNode = computed(() =>
    selectedNodes.value.length === 1 ? selectedNodes.value[0] : undefined
  )

  const layerTree = computed(() => {
    void state.sceneVersion
    return graph.flattenTree(state.currentPageId)
  })

  function requestRender() {
    state.renderVersion++
    state.sceneVersion++
  }

  function requestRepaint() {
    state.renderVersion++
  }

  let flashRafId = 0
  function flashNodes(nodeIds: string[]) {
    if (!_renderer) return
    for (const id of nodeIds) _renderer.flashNode(id)
    if (!flashRafId) pumpFlashes()
  }

  function aiMarkActive(nodeIds: string[]) {
    if (!_renderer) return
    _renderer.aiMarkActive(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiMarkDone(nodeIds: string[]) {
    if (!_renderer) return
    _renderer.aiMarkDone(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiFlashDone(nodeIds: string[]) {
    if (!_renderer) return
    _renderer.aiFlashDone(nodeIds)
    if (!flashRafId) pumpFlashes()
  }

  function aiClearAll() {
    if (!_renderer) return
    _renderer.aiClearAll()
  }

  function pumpFlashes() {
    if (!_renderer?.hasActiveFlashes) {
      flashRafId = 0
      return
    }
    state.renderVersion++
    flashRafId = requestAnimationFrame(pumpFlashes)
  }

  function isTopLevel(parentId: string | null): boolean {
    return !parentId || parentId === graph.rootId || parentId === state.currentPageId
  }

  async function switchPage(pageId: string) {
    const page = graph.getNode(pageId)
    if (page?.type !== 'CANVAS') return

    // Save current viewport
    pageViewports.set(state.currentPageId, {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      pageColor: { ...state.pageColor }
    })

    // Switch
    state.currentPageId = pageId
    state.enteredContainerId = null
    clearSelection()

    // Restore viewport
    const vp = pageViewports.get(pageId)
    if (vp) {
      state.panX = vp.panX
      state.panY = vp.panY
      state.zoom = vp.zoom
      state.pageColor = { ...vp.pageColor }
    } else {
      state.panX = 0
      state.panY = 0
      state.zoom = 1
      state.pageColor = { ...CANVAS_BG_COLOR }
    }

    await loadFontsForNodes(graph.getChildren(pageId).map((n) => n.id))
    requestRender()
  }

  function addPage(name?: string) {
    const pages = graph.getPages()
    const pageName = name ?? `Page ${pages.length + 1}`
    const page = graph.addPage(pageName)
    void switchPage(page.id)
    return page.id
  }

  function deletePage(pageId: string) {
    const pages = graph.getPages()
    if (pages.length <= 1) return
    const idx = pages.findIndex((p) => p.id === pageId)
    graph.deleteNode(pageId)
    pageViewports.delete(pageId)
    if (state.currentPageId === pageId) {
      const newIdx = Math.min(idx, pages.length - 2)
      const remaining = graph.getPages()
      void switchPage(remaining[newIdx].id)
    }
  }

  function renamePage(pageId: string, name: string) {
    graph.updateNode(pageId, { name })
  }

  function setTool(tool: Tool) {
    state.activeTool = tool
  }

  function select(ids: string[], additive = false) {
    if (additive) {
      const next = new Set(state.selectedIds)
      for (const id of ids) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      state.selectedIds = next
    } else {
      state.selectedIds = new Set(ids)
    }
  }

  function clearSelection() {
    state.selectedIds = new Set()
  }

  function validateEnteredContainer() {
    if (state.enteredContainerId && !graph.getNode(state.enteredContainerId)) {
      state.enteredContainerId = null
    }
  }

  function enterContainer(id: string) {
    state.enteredContainerId = id
  }

  function exitContainer() {
    const entered = state.enteredContainerId
    if (!entered) return
    const node = graph.getNode(entered)
    const parentId = node?.parentId
    if (parentId && parentId !== state.currentPageId) {
      state.enteredContainerId = parentId
    } else {
      state.enteredContainerId = null
    }
    state.selectedIds = new Set(entered ? [entered] : [])
  }

  function setMarquee(rect: Rect | null) {
    state.marquee = rect
    requestRepaint()
  }

  function setSnapGuides(guides: SnapGuide[]) {
    state.snapGuides = guides
    requestRepaint()
  }

  function setRotationPreview(preview: { nodeId: string; angle: number } | null) {
    state.rotationPreview = preview
    requestRepaint()
  }

  function setHoveredNode(id: string | null) {
    if (state.hoveredNodeId === id) return
    state.hoveredNodeId = id
    requestRepaint()
  }

  function setDropTarget(id: string | null) {
    state.dropTargetId = id
    requestRepaint()
  }

  function setLayoutInsertIndicator(indicator: typeof state.layoutInsertIndicator) {
    state.layoutInsertIndicator = indicator
    requestRepaint()
  }

  function doReorderChild(nodeId: string, parentId: string, insertIndex: number) {
    const node = graph.getNode(nodeId)
    if (!node) return

    if (node.parentId !== parentId) {
      const absPos = graph.getAbsolutePosition(nodeId)
      const parentAbs = graph.getAbsolutePosition(parentId)
      graph.updateNode(nodeId, { x: absPos.x - parentAbs.x, y: absPos.y - parentAbs.y })
    }

    graph.reorderChild(nodeId, parentId, insertIndex)
    computeLayout(graph, parentId)
    runLayoutForNode(parentId)
  }

  function reorderInAutoLayout(nodeId: string, parentId: string, insertIndex: number) {
    const parent = graph.getNode(parentId)
    if (!parent || parent.layoutMode === 'NONE') return

    const node = graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? state.currentPageId
    const origX = node.x
    const origY = node.y
    const origIndex = graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? -1

    doReorderChild(nodeId, parentId, insertIndex)

    undo.push({
      label: 'Reorder',
      forward: () => {
        doReorderChild(nodeId, parentId, insertIndex)
      },
      inverse: () => {
        graph.reorderChild(nodeId, origParentId, origIndex >= 0 ? origIndex : 0)
        graph.updateNode(nodeId, { x: origX, y: origY })
        computeLayout(graph, origParentId)
        runLayoutForNode(origParentId)
        if (origParentId !== parentId) {
          computeLayout(graph, parentId)
          runLayoutForNode(parentId)
        }
      }
    })
  }

  function reorderChildWithUndo(nodeId: string, newParentId: string, insertIndex: number) {
    const node = graph.getNode(nodeId)
    if (!node) return
    const origParentId = node.parentId ?? state.currentPageId
    const origIndex = graph.getNode(origParentId)?.childIds.indexOf(nodeId) ?? 0
    const origX = node.x
    const origY = node.y

    graph.reorderChild(nodeId, newParentId, insertIndex)
    runLayoutForNode(newParentId)
    if (origParentId !== newParentId) runLayoutForNode(origParentId)

    undo.push({
      label: 'Reorder',
      forward: () => {
        graph.reorderChild(nodeId, newParentId, insertIndex)
        runLayoutForNode(newParentId)
        if (origParentId !== newParentId) runLayoutForNode(origParentId)
      },
      inverse: () => {
        graph.reorderChild(nodeId, origParentId, origIndex)
        graph.updateNode(nodeId, { x: origX, y: origY })
        runLayoutForNode(origParentId)
        if (origParentId !== newParentId) runLayoutForNode(newParentId)
      }
    })
  }

  function reparentNodes(nodeIds: string[], newParentId: string) {
    const parent = graph.getNode(newParentId)
    for (const id of nodeIds) {
      const node = graph.getNode(id)
      // Sections can only live in pages (CANVAS) or other sections
      if (
        node?.type === 'SECTION' &&
        parent &&
        parent.type !== 'CANVAS' &&
        parent.type !== 'SECTION'
      )
        continue
      graph.reparentNode(id, newParentId)
    }
  }

  function penAddVertex(x: number, y: number) {
    if (!state.penState) {
      state.penState = {
        vertices: [{ x, y }],
        segments: [],
        dragTangent: null,
        closingToFirst: false
      }
      requestRender()
      return
    }

    const ps = state.penState
    const prevIdx = ps.vertices.length - 1

    // Check if clicking near first vertex to close
    const first = ps.vertices[0]
    const dist = Math.hypot(x - first.x, y - first.y)
    if (ps.vertices.length > 2 && dist < 8) {
      // Close the path
      ps.segments.push({
        start: prevIdx,
        end: 0,
        tangentStart: ps.dragTangent ?? { x: 0, y: 0 },
        tangentEnd: { x: 0, y: 0 }
      })
      penCommit(true)
      return
    }

    // Add new vertex and segment from previous
    ps.vertices.push({ x, y })
    const newIdx = ps.vertices.length - 1
    ps.segments.push({
      start: prevIdx,
      end: newIdx,
      tangentStart: ps.dragTangent ?? { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
    ps.dragTangent = null
    requestRender()
  }

  function penSetDragTangent(tx: number, ty: number) {
    if (!state.penState) return
    state.penState.dragTangent = { x: tx, y: ty }

    // Also set the tangentStart on the last segment (the one being dragged)
    const ps = state.penState
    if (ps.segments.length > 0) {
      const lastSeg = ps.segments[ps.segments.length - 1]
      lastSeg.tangentEnd = { x: -tx, y: -ty }
    }
    requestRender()
  }

  function penSetClosingToFirst(closing: boolean) {
    if (!state.penState) return
    state.penState.closingToFirst = closing
    requestRender()
  }

  function penCommit(closed: boolean) {
    const ps = state.penState
    if (!ps || ps.vertices.length < 2) {
      state.penState = null
      state.penCursorX = null
      state.penCursorY = null
      return
    }

    const regions: VectorRegion[] = closed
      ? [{ windingRule: 'NONZERO', loops: [ps.segments.map((_, i) => i)] }]
      : []

    const network: VectorNetwork = {
      vertices: ps.vertices,
      segments: ps.segments,
      regions
    }

    const bounds = computeVectorBounds(network)

    // Normalize vertices relative to bounds origin
    const normalizedVertices = network.vertices.map((v) => ({
      ...v,
      x: v.x - bounds.x,
      y: v.y - bounds.y
    }))

    const normalizedNetwork: VectorNetwork = {
      vertices: normalizedVertices,
      segments: network.segments,
      regions: network.regions
    }

    const nodeId = createShape('VECTOR', bounds.x, bounds.y, bounds.width, bounds.height)
    updateNode(nodeId, {
      vectorNetwork: normalizedNetwork,
      name: 'Vector',
      fills: closed ? [{ ...DEFAULT_SHAPE_FILL }] : [],
      strokes: closed
        ? []
        : [
            {
              color: { r: 0, g: 0, b: 0, a: 1 },
              weight: 2,
              opacity: 1,
              visible: true,
              align: 'CENTER' as const
            }
          ]
    })
    select([nodeId])

    state.penState = null
    state.penCursorX = null
    state.penCursorY = null
    state.activeTool = 'SELECT'
    requestRender()
  }

  function penCancel() {
    state.penState = null
    state.penCursorX = null
    state.penCursorY = null
    state.activeTool = 'SELECT'
    requestRender()
  }

  function startTextEditing(nodeId: string) {
    if (state.editingTextId) commitTextEdit()
    const node = graph.getNode(nodeId)
    if (!node) return
    state.editingTextId = nodeId
    if (_textEditor) {
      _textEditor.setRenderer(_renderer)
      _textEditor.start(node)
    }
    requestRender()
  }

  function commitTextEdit() {
    if (!_textEditor?.isActive) {
      state.editingTextId = null
      return
    }
    const result = _textEditor.stop()
    if (!result) {
      state.editingTextId = null
      requestRender()
      return
    }
    const node = graph.getNode(result.nodeId)
    const prevText = node?.text ?? ''
    const newText = result.text
    graph.updateNode(result.nodeId, { text: newText })
    state.editingTextId = null
    if (prevText !== newText) {
      undo.push({
        label: 'Edit text',
        forward: () => {
          graph.updateNode(result.nodeId, { text: newText })
        },
        inverse: () => {
          graph.updateNode(result.nodeId, { text: prevText })
        }
      })
    }
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
      graph = imported
      computeAllLayouts(graph)
      subscribeToGraph()
      undo.clear()
      pageViewports.clear()
      fileHandle = handle ?? null
      filePath = path ?? null
      state.documentName = file.name.replace(/\.fig$/i, '')
      downloadName = file.name
      state.selectedIds = new Set()
      const firstPage = graph.getPages()[0] as SceneNode | undefined
      const pageId = firstPage?.id ?? graph.rootId
      state.currentPageId = pageId
      state.panX = 0
      state.panY = 0
      state.zoom = 1
      state.pageColor = { ...CANVAS_BG_COLOR }
      await loadFontsForNodes(graph.getChildren(pageId).map((n) => n.id))
      requestRender()
      void startWatchingFile()
    } catch (e) {
      console.error('Failed to open .fig file:', e)
      toast.show(`Failed to open file: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      state.loading = false
    }
  }

  function setCanvasKit(ck: CanvasKit, renderer: SkiaRenderer) {
    _ck = ck
    _renderer = renderer
    _textEditor = new TextEditor(ck)
    setTextMeasurer((node, maxWidth) => renderer.measureTextNode(node, maxWidth))
  }

  function buildFigFile() {
    return exportFigFile(graph, _ck ?? undefined, _renderer ?? undefined, state.currentPageId)
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
      graph = imported
      computeAllLayouts(graph)
      subscribeToGraph()
    } else if (fileHandle) {
      const file = await fileHandle.getFile()
      const imported = await readFigFile(file)
      graph = imported
      computeAllLayouts(graph)
      subscribeToGraph()
    } else {
      return
    }

    undo.clear()
    savedVersion = state.sceneVersion
    state.selectedIds = new Set()
    if (graph.getNode(pageId)) {
      state.currentPageId = pageId
    } else {
      state.currentPageId = graph.getPages()[0]?.id ?? graph.rootId
    }
    state.panX = viewport.panX
    state.panY = viewport.panY
    state.zoom = viewport.zoom
    requestRender()
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

  async function renderExportImage(
    nodeIds: string[],
    scale: number,
    format: ExportFormat
  ): Promise<Uint8Array | null> {
    if (!_ck || !_renderer) return null
    const ids =
      nodeIds.length > 0 ? nodeIds : graph.getChildren(state.currentPageId).map((n) => n.id)
    if (ids.length === 0) return null
    return renderNodesToImage(_ck, _renderer, graph, state.currentPageId, ids, { scale, format })
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
      const nodeIds = ids.length > 0 ? ids : graph.getChildren(state.currentPageId).map((n) => n.id)
      const svgStr = renderNodesToSVG(graph, state.currentPageId, nodeIds)
      if (!svgStr) {
        console.error('Export failed: renderNodesToSVG returned null')
        return
      }
      const svgData = new TextEncoder().encode(svgStr)
      const node = ids.length === 1 ? graph.getNode(ids[0]) : undefined
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

    const node = ids.length === 1 ? graph.getNode(ids[0]) : undefined
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

  function runLayoutForNode(id: string) {
    const node = graph.getNode(id)
    if (!node) return

    if (node.layoutMode !== 'NONE') {
      computeLayout(graph, id)
    }

    let parent = node.parentId ? graph.getNode(node.parentId) : undefined
    while (parent) {
      if (parent.layoutMode !== 'NONE') {
        computeLayout(graph, parent.id)
      }
      parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
    }
  }

  // ─── Graph event subscriptions ────────────────────────────────
  // Microtask-batched component sync: collects mutated node IDs during a
  // synchronous block, deduplicates to unique ancestor components, then
  // calls syncInstances once per component in one microtask.
  let pendingComponentSync: Set<string> | null = null

  function flushComponentSync() {
    const ids = pendingComponentSync
    if (!ids) return
    pendingComponentSync = null
    const componentIds = new Set<string>()
    for (const id of ids) {
      let current = graph.getNode(id)
      while (current) {
        if (current.type === 'COMPONENT') {
          componentIds.add(current.id)
          break
        }
        current = current.parentId ? graph.getNode(current.parentId) : undefined
      }
    }
    for (const compId of componentIds) {
      graph.syncInstances(compId)
    }
    if (componentIds.size > 0) requestRender()
  }

  function scheduleComponentSync(nodeId: string) {
    if (!pendingComponentSync) {
      pendingComponentSync = new Set()
      queueMicrotask(flushComponentSync)
    }
    pendingComponentSync.add(nodeId)
  }

  function onNodeUpdated(id: string, changes: Partial<SceneNode>) {
    if ('vectorNetwork' in changes) {
      _renderer?.invalidateVectorPath(id)
    }
    _renderer?.invalidateNodePicture(id)
    scheduleComponentSync(id)
    requestRender()
  }

  function onNodeStructureChanged(nodeId: string) {
    scheduleComponentSync(nodeId)
    requestRender()
  }

  function subscribeToGraph() {
    graph.emitter.on('node:updated', onNodeUpdated)
    graph.emitter.on('node:created', (node) => onNodeStructureChanged(node.id))
    graph.emitter.on('node:deleted', onNodeStructureChanged)
    graph.emitter.on('node:reparented', onNodeStructureChanged)
    graph.emitter.on('node:reordered', onNodeStructureChanged)
  }

  subscribeToGraph()

  function updateNode(id: string, changes: Partial<SceneNode>) {
    graph.updateNode(id, changes)
    runLayoutForNode(id)
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    const node = graph.getNode(id)
    if (!node) return
    const previous = Object.fromEntries(
      (Object.keys(changes) as (keyof SceneNode)[]).map((key) => [key, node[key]])
    ) as Partial<SceneNode>
    graph.updateNode(id, changes)
    runLayoutForNode(id)
    undo.push({
      label,
      forward: () => {
        graph.updateNode(id, changes)
        runLayoutForNode(id)
      },
      inverse: () => {
        graph.updateNode(id, previous)
        runLayoutForNode(id)
      }
    })
  }

  function setLayoutMode(id: string, mode: LayoutMode) {
    const node = graph.getNode(id)
    if (!node) return

    const previous: Partial<SceneNode> = {
      layoutMode: node.layoutMode,
      itemSpacing: node.itemSpacing,
      paddingTop: node.paddingTop,
      paddingRight: node.paddingRight,
      paddingBottom: node.paddingBottom,
      paddingLeft: node.paddingLeft,
      primaryAxisSizing: node.primaryAxisSizing,
      counterAxisSizing: node.counterAxisSizing,
      primaryAxisAlign: node.primaryAxisAlign,
      counterAxisAlign: node.counterAxisAlign,
      gridTemplateColumns: node.gridTemplateColumns,
      gridTemplateRows: node.gridTemplateRows,
      gridColumnGap: node.gridColumnGap,
      gridRowGap: node.gridRowGap,
      width: node.width,
      height: node.height
    }

    const updates: Partial<SceneNode> = { layoutMode: mode }
    if (mode === 'GRID' && node.layoutMode !== 'GRID') {
      const children = graph.getChildren(id)
      const cols = Math.max(2, Math.ceil(Math.sqrt(children.length)))
      const rows = Math.max(1, Math.ceil(children.length / cols))
      updates.gridTemplateColumns = Array.from({ length: cols }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
      updates.gridTemplateRows = Array.from({ length: rows }, () => ({
        sizing: 'FR' as const,
        value: 1
      }))
      updates.gridColumnGap = 0
      updates.gridRowGap = 0
      updates.primaryAxisSizing = 'FIXED'
      updates.counterAxisSizing = 'FIXED'
      if (node.primaryAxisSizing === 'HUG' || node.counterAxisSizing === 'HUG') {
        const maxChildW = Math.max(...children.map((c) => c.width), 100)
        const maxChildH = Math.max(...children.map((c) => c.height), 100)
        updates.width = maxChildW * cols
        updates.height = maxChildH * rows
      }
      updates.paddingTop = 0
      updates.paddingRight = 0
      updates.paddingBottom = 0
      updates.paddingLeft = 0
    } else if (mode !== 'NONE' && node.layoutMode === 'NONE') {
      updates.itemSpacing = 0
      updates.paddingTop = 0
      updates.paddingRight = 0
      updates.paddingBottom = 0
      updates.paddingLeft = 0
      updates.primaryAxisSizing = 'HUG'
      updates.counterAxisSizing = 'HUG'
      updates.primaryAxisAlign = 'MIN'
      updates.counterAxisAlign = 'MIN'
    }

    graph.updateNode(id, updates)
    if (mode !== 'NONE') computeLayout(graph, id)
    runLayoutForNode(id)

    const updated = graph.getNode(id)
    if (!updated) return
    const finalState = Object.fromEntries(
      (Object.keys(previous) as (keyof SceneNode)[]).map((key) => [key, updated[key]])
    ) as Partial<SceneNode>

    undo.push({
      label: mode === 'NONE' ? 'Remove auto layout' : 'Add auto layout',
      forward: () => {
        graph.updateNode(id, finalState)
        if (mode !== 'NONE') computeLayout(graph, id)
        runLayoutForNode(id)
      },
      inverse: () => {
        graph.updateNode(id, previous)
        runLayoutForNode(id)
      }
    })
  }

  function wrapInAutoLayout() {
    const nodes = selectedNodes.value
    if (nodes.length === 0) return

    const parentId = nodes[0].parentId ?? state.currentPageId
    const sameParent = nodes.every((n) => (n.parentId ?? state.currentPageId) === parentId)
    if (!sameParent) return

    const prevSelection = new Set(state.selectedIds)
    const origPositions = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, parentId }))

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const abs = graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + n.width)
      maxY = Math.max(maxY, abs.y + n.height)
    }

    const parentAbs = isTopLevel(parentId) ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)

    const direction: LayoutMode =
      nodes.length <= 1 || maxY - minY > maxX - minX ? 'VERTICAL' : 'HORIZONTAL'

    const frame = graph.createNode('FRAME', parentId, {
      name: 'Frame',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width: maxX - minX,
      height: maxY - minY,
      layoutMode: direction,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      fills: []
    })
    const frameId = frame.id

    const sortedIds = nodes
      .map((n) => ({ id: n.id, pos: graph.getAbsolutePosition(n.id) }))
      .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
      .map((n) => n.id)

    for (const id of sortedIds) {
      graph.reparentNode(id, frameId)
    }

    computeLayout(graph, frameId)
    runLayoutForNode(frameId)
    state.selectedIds = new Set([frameId])

    undo.push({
      label: 'Wrap in auto layout',
      forward: () => {
        // Re-create frame and reparent
        const f = graph.createNode('FRAME', parentId, { ...frame })
        for (const n of origPositions) graph.reparentNode(n.id, f.id)
        computeLayout(graph, f.id)
        runLayoutForNode(f.id)
        state.selectedIds = new Set([f.id])
      },
      inverse: () => {
        // Move children back to original parent and delete frame
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, orig.parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(frameId)
        state.selectedIds = prevSelection
      }
    })
  }

  function groupSelected() {
    const nodes = selectedNodes.value
    if (nodes.length === 0) return

    const parentId = nodes[0].parentId ?? state.currentPageId
    const sameParent = nodes.every((n) => (n.parentId ?? state.currentPageId) === parentId)
    if (!sameParent) return

    const parent = graph.getNode(parentId)
    if (!parent) return

    const prevSelection = new Set(state.selectedIds)
    const nodeIds = nodes.map((n) => n.id)
    const origPositions = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

    // Bounding box from absolute positions
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const abs = graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + n.width)
      maxY = Math.max(maxY, abs.y + n.height)
    }

    const parentAbs = isTopLevel(parentId) ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)

    // Insert group at the position of the topmost selected node
    const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

    const group = graph.createNode('GROUP', parentId, {
      name: 'Group',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width: maxX - minX,
      height: maxY - minY,
      fills: []
    })
    const groupId = group.id

    // Move group to the correct z-order position
    parent.childIds = parent.childIds.filter((id) => id !== groupId)
    parent.childIds.splice(firstIndex, 0, groupId)

    for (const n of nodes) {
      graph.reparentNode(n.id, groupId)
    }

    state.selectedIds = new Set([groupId])

    undo.push({
      label: 'Group',
      forward: () => {
        const g = graph.createNode('GROUP', parentId, { ...group })
        parent.childIds = parent.childIds.filter((id) => id !== g.id)
        parent.childIds.splice(firstIndex, 0, g.id)
        for (const n of origPositions) graph.reparentNode(n.id, g.id)
        state.selectedIds = new Set([g.id])
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(groupId)
        state.selectedIds = prevSelection
      }
    })
  }

  function createComponentFromSelection() {
    const nodes = selectedNodes.value
    if (nodes.length === 0) return

    const prevSelection = new Set(state.selectedIds)

    if (nodes.length === 1) {
      const node = nodes[0]
      const prevType = node.type

      if (node.type === 'COMPONENT') return

      if (node.type === 'FRAME' || node.type === 'GROUP') {
        graph.updateNode(node.id, { type: 'COMPONENT' })
        state.selectedIds = new Set([node.id])
        undo.push({
          label: 'Create component',
          forward: () => {
            graph.updateNode(node.id, { type: 'COMPONENT' })
            state.selectedIds = new Set([node.id])
          },
          inverse: () => {
            graph.updateNode(node.id, { type: prevType })
            state.selectedIds = prevSelection
          }
        })
        return
      }
    }

    const parentId = nodes[0].parentId ?? state.currentPageId
    const sameParent = nodes.every((n) => (n.parentId ?? state.currentPageId) === parentId)
    if (!sameParent) return

    const parent = graph.getNode(parentId)
    if (!parent) return

    const nodeIds = nodes.map((n) => n.id)
    const origPositions = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const abs = graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + n.width)
      maxY = Math.max(maxY, abs.y + n.height)
    }

    const parentAbs = isTopLevel(parentId) ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)
    const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

    const component = graph.createNode('COMPONENT', parentId, {
      name: 'Component',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width: maxX - minX,
      height: maxY - minY,
      fills: []
    })
    const componentId = component.id

    parent.childIds = parent.childIds.filter((id) => id !== componentId)
    parent.childIds.splice(firstIndex, 0, componentId)

    for (const n of nodes) {
      graph.reparentNode(n.id, componentId)
    }

    state.selectedIds = new Set([componentId])

    undo.push({
      label: 'Create component',
      forward: () => {
        const c = graph.createNode('COMPONENT', parentId, { ...component })
        parent.childIds = parent.childIds.filter((id) => id !== c.id)
        parent.childIds.splice(firstIndex, 0, c.id)
        for (const n of origPositions) graph.reparentNode(n.id, c.id)
        state.selectedIds = new Set([c.id])
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(componentId)
        state.selectedIds = prevSelection
      }
    })
  }

  function createComponentSetFromComponents() {
    const nodes = selectedNodes.value
    if (nodes.length < 2) return
    if (!nodes.every((n) => n.type === 'COMPONENT')) return

    const parentId = nodes[0].parentId ?? state.currentPageId
    const sameParent = nodes.every((n) => (n.parentId ?? state.currentPageId) === parentId)
    if (!sameParent) return

    const parent = graph.getNode(parentId)
    if (!parent) return

    const prevSelection = new Set(state.selectedIds)
    const nodeIds = nodes.map((n) => n.id)
    const origPositions = nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const abs = graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + n.width)
      maxY = Math.max(maxY, abs.y + n.height)
    }

    const padding = 40
    const parentAbs = isTopLevel(parentId) ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)
    const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

    const componentSet = graph.createNode('COMPONENT_SET', parentId, {
      name: nodes[0].name.split('/')[0]?.trim() || 'Component Set',
      x: minX - parentAbs.x - padding,
      y: minY - parentAbs.y - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      fills: [
        { type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.96, a: 1 }, opacity: 1, visible: true }
      ]
    })
    const setId = componentSet.id

    parent.childIds = parent.childIds.filter((id) => id !== setId)
    parent.childIds.splice(firstIndex, 0, setId)

    for (const n of nodes) {
      graph.reparentNode(n.id, setId)
    }

    state.selectedIds = new Set([setId])

    undo.push({
      label: 'Create component set',
      forward: () => {
        const cs = graph.createNode('COMPONENT_SET', parentId, { ...componentSet })
        parent.childIds = parent.childIds.filter((id) => id !== cs.id)
        parent.childIds.splice(firstIndex, 0, cs.id)
        for (const n of origPositions) graph.reparentNode(n.id, cs.id)
        state.selectedIds = new Set([cs.id])
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(setId)
        state.selectedIds = prevSelection
      }
    })
  }

  function createInstanceFromComponent(componentId: string, x?: number, y?: number) {
    const component = graph.getNode(componentId)
    if (component?.type !== 'COMPONENT') return null

    const parentId = component.parentId ?? state.currentPageId
    const instance = graph.createInstance(componentId, parentId, {
      x: x ?? component.x + component.width + 40,
      y: y ?? component.y
    })
    if (!instance) return null

    const instanceId = instance.id
    state.selectedIds = new Set([instanceId])

    undo.push({
      label: 'Create instance',
      forward: () => {
        graph.createInstance(componentId, parentId, { ...instance })
        state.selectedIds = new Set([instanceId])
      },
      inverse: () => {
        graph.deleteNode(instanceId)
        state.selectedIds = new Set([componentId])
      }
    })
    return instanceId
  }

  function detachInstance() {
    const node = selectedNode.value
    if (node?.type !== 'INSTANCE') return

    const prevComponentId = node.componentId

    graph.detachInstance(node.id)
    state.selectedIds = new Set([node.id])

    undo.push({
      label: 'Detach instance',
      forward: () => {
        graph.detachInstance(node.id)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(node.id, { type: 'INSTANCE', componentId: prevComponentId, overrides: {} })
      }
    })
  }

  function goToMainComponent() {
    const node = selectedNode.value
    if (!node?.componentId) return
    const main = graph.getMainComponent(node.id)
    if (!main) return

    // Find which page the main component is on
    let current: SceneNode | undefined = main
    while (current && current.type !== 'CANVAS') {
      current = current.parentId ? graph.getNode(current.parentId) : undefined
    }
    if (current && current.id !== state.currentPageId) {
      void switchPage(current.id)
    }

    state.selectedIds = new Set([main.id])

    const abs = graph.getAbsolutePosition(main.id)
    const viewW = 800
    const viewH = 600
    state.panX = viewW / 2 - (abs.x + main.width / 2) * state.zoom
    state.panY = viewH / 2 - (abs.y + main.height / 2) * state.zoom
    requestRender()
  }

  function ungroupSelected() {
    const node = selectedNode.value
    if (node?.type !== 'GROUP') return

    const parentId = node.parentId ?? state.currentPageId
    const parent = graph.getNode(parentId)
    if (!parent) return

    const groupIndex = parent.childIds.indexOf(node.id)
    const childIds = [...node.childIds]
    const prevSelection = new Set(state.selectedIds)
    const origPositions = childIds.map((id) => {
      const child = graph.getNode(id)
      if (!child) return { id, x: 0, y: 0 }
      return { id, x: child.x, y: child.y }
    })
    const groupSnapshot = { ...node, childIds: [...node.childIds] }

    // Reparent children to the group's parent, preserving visual position
    for (let i = 0; i < childIds.length; i++) {
      graph.reparentNode(childIds[i], parentId)
      // Move to correct z-order (where the group was)
      parent.childIds = parent.childIds.filter((id) => id !== childIds[i])
      parent.childIds.splice(groupIndex + i, 0, childIds[i])
    }

    graph.deleteNode(node.id)
    state.selectedIds = new Set(childIds)

    undo.push({
      label: 'Ungroup',
      forward: () => {
        for (let i = 0; i < childIds.length; i++) {
          graph.reparentNode(childIds[i], parentId)
          parent.childIds = parent.childIds.filter((id) => id !== childIds[i])
          parent.childIds.splice(groupIndex + i, 0, childIds[i])
        }
        graph.deleteNode(node.id)
        state.selectedIds = new Set(childIds)
      },
      inverse: () => {
        const g = graph.createNode('GROUP', parentId, { ...groupSnapshot, childIds: [] })
        parent.childIds = parent.childIds.filter((id) => id !== g.id)
        parent.childIds.splice(groupIndex, 0, g.id)
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, g.id)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        state.selectedIds = prevSelection
      }
    })
  }

  function bringToFront() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node?.parentId) continue
      const parent = graph.getNode(node.parentId)
      if (!parent) continue
      const idx = parent.childIds.indexOf(id)
      if (idx === parent.childIds.length - 1) continue
      parent.childIds = parent.childIds.filter((cid) => cid !== id)
      parent.childIds.push(id)
    }
    requestRender()
  }

  function sendToBack() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node?.parentId) continue
      const parent = graph.getNode(node.parentId)
      if (!parent) continue
      const idx = parent.childIds.indexOf(id)
      if (idx === 0) continue
      parent.childIds = parent.childIds.filter((cid) => cid !== id)
      parent.childIds.unshift(id)
    }
    requestRender()
  }

  function toggleProfiler() {
    _renderer?.profiler.toggle()
    requestRepaint()
  }

  function toggleVisibility() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, { visible: !node.visible })
    }
  }

  function toggleLock() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, { locked: !node.locked })
    }
  }

  function moveToPage(pageId: string) {
    const targetPage = graph.getNode(pageId)
    if (targetPage?.type !== 'CANVAS') return
    const ids = [...state.selectedIds]
    for (const id of ids) {
      graph.reparentNode(id, pageId)
    }
    clearSelection()
  }

  function renameNode(id: string, name: string) {
    graph.updateNode(id, { name })
  }

  function createShape(
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string
  ): string {
    const fill = DEFAULT_FILLS[type] ?? DEFAULT_FILLS.RECTANGLE
    const pid = parentId ?? state.currentPageId
    const overrides: Partial<SceneNode> = {
      x,
      y,
      width: w,
      height: h,
      fills: [{ ...fill }]
    }
    if (type === 'SECTION') {
      overrides.strokes = [{ ...SECTION_DEFAULT_STROKE }]
      overrides.cornerRadius = 5
    }
    if (type === 'POLYGON') {
      overrides.pointCount = 3
    }
    if (type === 'STAR') {
      overrides.pointCount = 5
      overrides.starInnerRadius = 0.38
    }
    const node = graph.createNode(type, pid, overrides)
    const id = node.id
    const snapshot = { ...node }
    undo.push({
      label: `Create ${type.toLowerCase()}`,
      forward: () => {
        graph.createNode(snapshot.type, pid, snapshot)
      },
      inverse: () => {
        graph.deleteNode(id)
        const next = new Set(state.selectedIds)
        next.delete(id)
        state.selectedIds = next
      }
    })
    return id
  }

  const IMAGE_MAX_DIMENSION = 4096
  const IMAGE_GAP = 20

  async function placeImageFiles(files: File[], cx: number, cy: number) {
    if (!_ck) return

    const prepared: Array<{ bytes: Uint8Array; name: string; w: number; h: number }> = []
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dims = decodeImageDimensions(bytes)
      if (dims) prepared.push({ bytes, name: file.name, ...dims })
    }
    if (!prepared.length) return

    let totalW = 0
    for (const p of prepared) totalW += p.w
    totalW += IMAGE_GAP * (prepared.length - 1)
    const maxH = Math.max(...prepared.map((p) => p.h))

    let curX = cx - totalW / 2
    const topY = cy - maxH / 2
    const ids: string[] = []
    for (const p of prepared) {
      const id = await placeImageNode(p.bytes, curX, topY, p.w, p.h, p.name)
      if (id) ids.push(id)
      curX += p.w + IMAGE_GAP
    }
    if (ids.length) {
      select(ids)
      requestRender()
    }
  }

  function decodeImageDimensions(bytes: Uint8Array): { w: number; h: number } | null {
    if (!_ck) return null
    const skImg = _ck.MakeImageFromEncoded(bytes)
    if (!skImg) return null
    let w = skImg.width()
    let h = skImg.height()
    skImg.delete()
    if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
      const ratio = Math.min(IMAGE_MAX_DIMENSION / w, IMAGE_MAX_DIMENSION / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    return { w, h }
  }

  function storeImage(bytes: Uint8Array): string {
    const hash = computeImageHash(bytes)
    graph.images.set(hash, bytes)
    return hash
  }

  async function placeImageNode(
    bytes: Uint8Array,
    x: number,
    y: number,
    w: number,
    h: number,
    name = 'Image'
  ): Promise<string | null> {
    const hash = storeImage(bytes)

    const displayName = name.replace(/\.[^.]+$/, '')
    const pid = state.currentPageId
    const fill: Fill = {
      type: 'IMAGE',
      imageHash: hash,
      imageScaleMode: 'FILL',
      color: { r: 0, g: 0, b: 0, a: 0 },
      opacity: 1,
      visible: true
    }
    const node = graph.createNode('RECTANGLE', pid, {
      name: displayName,
      x,
      y,
      width: w,
      height: h,
      fills: [fill]
    })
    const id = node.id
    const snapshot = { ...node }
    undo.push({
      label: 'Place image',
      forward: () => {
        graph.images.set(hash, bytes)
        graph.createNode(snapshot.type, pid, snapshot)
      },
      inverse: () => {
        graph.deleteNode(id)
        graph.images.delete(hash)
        const next = new Set(state.selectedIds)
        next.delete(id)
        state.selectedIds = next
      }
    })
    return id
  }

  function adoptNodesIntoSection(sectionId: string) {
    const section = graph.getNode(sectionId)
    if (section?.type !== 'SECTION') return

    const parentId = section.parentId ?? state.currentPageId
    const siblings = graph.getChildren(parentId)

    const sx = section.x
    const sy = section.y
    const sx2 = sx + section.width
    const sy2 = sy + section.height

    const toAdopt: string[] = []
    for (const sibling of siblings) {
      if (sibling.id === sectionId) continue
      const nx = sibling.x
      const ny = sibling.y
      const nx2 = nx + sibling.width
      const ny2 = ny + sibling.height
      if (nx >= sx && ny >= sy && nx2 <= sx2 && ny2 <= sy2) {
        toAdopt.push(sibling.id)
      }
    }

    if (toAdopt.length === 0) return

    const undoOps: Array<{
      id: string
      oldParent: string
      oldX: number
      oldY: number
      newX: number
      newY: number
    }> = []
    for (const id of toAdopt) {
      const node = graph.getNode(id)
      if (!node) continue
      const newX = node.x - sx
      const newY = node.y - sy
      undoOps.push({ id, oldParent: parentId, oldX: node.x, oldY: node.y, newX, newY })
      graph.reparentNode(id, sectionId)
      graph.updateNode(id, { x: newX, y: newY })
    }

    undo.push({
      label: 'Adopt into section',
      forward: () => {
        for (const op of undoOps) {
          graph.reparentNode(op.id, sectionId)
          graph.updateNode(op.id, { x: op.newX, y: op.newY })
        }
      },
      inverse: () => {
        for (const op of undoOps) {
          graph.reparentNode(op.id, op.oldParent)
          graph.updateNode(op.id, { x: op.oldX, y: op.oldY })
        }
      }
    })
  }

  function selectAll() {
    const children = graph.getChildren(state.currentPageId)
    state.selectedIds = new Set(children.map((n) => n.id))
  }

  function duplicateSelected() {
    const prevSelection = new Set(state.selectedIds)
    const newIds: string[] = []
    const snapshots: Array<{ id: string; parentId: string; snapshot: SceneNode }> = []

    for (const id of state.selectedIds) {
      const src = graph.getNode(id)
      if (!src) continue
      const parentId = src.parentId ?? state.currentPageId
      const { id: _srcId, parentId: _srcParent, childIds: _srcChildren, ...srcRest } = src
      const node = graph.createNode(src.type, parentId, {
        ...srcRest,
        name: src.name + ' copy',
        x: src.x + 20,
        y: src.y + 20
      })
      newIds.push(node.id)
      snapshots.push({ id: node.id, parentId, snapshot: { ...node } })
    }

    if (newIds.length > 0) {
      state.selectedIds = new Set(newIds)
      undo.push({
        label: 'Duplicate',
        forward: () => {
          for (const { snapshot, parentId } of snapshots) {
            graph.createNode(snapshot.type, parentId, snapshot)
          }
          state.selectedIds = new Set(newIds)
        },
        inverse: () => {
          for (const { id } of snapshots) graph.deleteNode(id)
          state.selectedIds = prevSelection
        }
      })
    }
  }

  function writeCopyData(clipboardData: DataTransfer) {
    const nodes = selectedNodes.value
    if (nodes.length === 0) return

    const names = nodes.map((n) => n.name).join('\n')
    const html = buildFigmaClipboardHTML(nodes, graph)
    if (html) clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
  }

  function centerNodesAt(nodeIds: string[], cx: number, cy: number) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of nodeIds) {
      const n = graph.getNode(id)
      if (!n) continue
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    }
    if (minX === Infinity) return
    const dx = cx - (minX + maxX) / 2
    const dy = cy - (minY + maxY) / 2
    for (const id of nodeIds) {
      const n = graph.getNode(id)
      if (n) graph.updateNode(id, { x: n.x + dx, y: n.y + dy })
    }
  }

  function collectSubtrees(g: SceneGraph, rootIds: string[]): SceneNode[] {
    const result: SceneNode[] = []
    function walk(id: string) {
      const node = g.getNode(id)
      if (!node) return
      result.push({ ...node })
      for (const childId of node.childIds) walk(childId)
    }
    for (const id of rootIds) walk(id)
    return result
  }

  async function loadFontsForNodes(nodeIds: string[]) {
    const toLoad = collectFontKeys(graph, nodeIds)
    if (toLoad.length === 0) return

    const results = await Promise.all(toLoad.map(([family, style]) => loadFont(family, style)))
    const failed = toLoad.filter((_, i) => results[i] === null)
    if (failed.length > 0) {
      const families = [...new Set(failed.map(([family]) => family))]
      toast.show(
        families.length === 1
          ? `Font "${families[0]}" could not be loaded`
          : `${families.length} fonts could not be loaded: ${families.join(', ')}`,
        'warning'
      )
    }
    computeAllLayouts(graph, state.currentPageId)
  }

  function pasteFromHTML(html: string, cursorPos?: Vector) {
    void parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const prevSelection = new Set(state.selectedIds)
        const created = importClipboardNodes(
          figma.nodes,
          graph,
          state.currentPageId,
          0,
          0,
          figma.blobs
        )
        if (created.length > 0) {
          const cx = cursorPos?.x ?? (-state.panX + window.innerWidth / 2) / state.zoom
          const cy = cursorPos?.y ?? (-state.panY + window.innerHeight / 2) / state.zoom
          centerNodesAt(created, cx, cy)
          computeAllLayouts(graph, state.currentPageId)
          state.selectedIds = new Set(created)

          const allNodes = collectSubtrees(graph, created)
          const pageId = state.currentPageId
          undo.push({
            label: 'Paste',
            forward: () => {
              for (const snapshot of allNodes) {
                graph.createNode(snapshot.type, snapshot.parentId ?? pageId, {
                  ...snapshot,
                  childIds: []
                })
              }
              computeAllLayouts(graph, pageId)
              state.selectedIds = new Set(created)
            },
            inverse: () => {
              for (const id of [...created].reverse()) graph.deleteNode(id)
              computeAllLayouts(graph, pageId)
              state.selectedIds = prevSelection
            }
          })
          void loadFontsForNodes(created)
          warnMissingImages(created)
        }
      }
    })
  }

  function warnMissingImages(nodeIds: string[]) {
    const allNodes = collectSubtrees(graph, nodeIds)
    const hasMissing = allNodes.some((n) =>
      n.fills.some((f) => f.type === 'IMAGE' && f.imageHash && !graph.images.has(f.imageHash))
    )
    if (hasMissing) {
      toast.show(
        "Some images couldn't be pasted — Figma doesn't include image data in clipboard",
        'warning'
      )
    }
  }

  async function renderJSXWithUndo(jsxString: string, replaceNodeIds?: string[]) {
    const { renderJSX } = await import('@open-pencil/core/render')
    const pageId = state.currentPageId
    const prevSelection = new Set(state.selectedIds)
    const replacing = replaceNodeIds && replaceNodeIds.length > 0

    let oldSnapshots: SceneNode[] = []
    let insertParentId = pageId
    let insertIndex = -1

    if (replacing) {
      const first = graph.getNode(replaceNodeIds[0])
      if (first?.parentId) {
        insertParentId = first.parentId
        const parent = graph.getNode(insertParentId)
        if (parent) insertIndex = parent.childIds.indexOf(replaceNodeIds[0])
      }
      oldSnapshots = collectSubtrees(graph, replaceNodeIds)
      for (const id of [...replaceNodeIds].reverse()) graph.deleteNode(id)
    }

    const results = await renderJSX(graph, jsxString, { parentId: insertParentId })
    const rootIds = results.map((r) => r.id)

    if (insertIndex >= 0) {
      for (let i = rootIds.length - 1; i >= 0; i--) {
        graph.reorderChild(rootIds[i], insertParentId, insertIndex)
      }
    }

    computeAllLayouts(graph, pageId)
    const newSnapshots = collectSubtrees(graph, rootIds)
    state.selectedIds = new Set(rootIds)
    requestRender()

    const oldRootIds = replacing ? replaceNodeIds.filter((id) => oldSnapshots.some((n) => n.id === id)) : []

    undo.push({
      label: 'Render JSX',
      forward: () => {
        for (const id of [...oldRootIds].reverse()) graph.deleteNode(id)
        for (const s of newSnapshots) graph.createNode(s.type, s.parentId ?? pageId, { ...s, childIds: [] })
        computeAllLayouts(graph, pageId)
        state.selectedIds = new Set(rootIds)
      },
      inverse: () => {
        for (const id of [...rootIds].reverse()) graph.deleteNode(id)
        for (const s of oldSnapshots) graph.createNode(s.type, s.parentId ?? pageId, { ...s, childIds: [] })
        computeAllLayouts(graph, pageId)
        state.selectedIds = prevSelection
      }
    })
  }

  function deleteSelected() {
    const entries: Array<{ id: string; parentId: string; snapshot: SceneNode; index: number }> = []
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node || node.locked) continue
      const parentId = node.parentId ?? state.currentPageId
      const parent = graph.getNode(parentId)
      const index = parent?.childIds.indexOf(id) ?? -1
      entries.push({ id, parentId, snapshot: { ...node }, index })
    }
    if (entries.length === 0) return

    const prevSelection = new Set(state.selectedIds)
    for (const { id } of entries) graph.deleteNode(id)

    undo.push({
      label: 'Delete',
      forward: () => {
        for (const { id } of entries) graph.deleteNode(id)
        clearSelection()
      },
      inverse: () => {
        for (const { snapshot, parentId, index } of [...entries].reverse()) {
          graph.createNode(snapshot.type, parentId, snapshot)
          if (index >= 0) {
            graph.reorderChild(snapshot.id, parentId, index)
          }
        }
        state.selectedIds = prevSelection
      }
    })
    clearSelection()
  }

  function mobileCopy() {
    const transfer = new DataTransfer()
    writeCopyData(transfer)
    state.clipboardHtml = transfer.getData('text/html')
  }

  function mobileCut() {
    mobileCopy()
    deleteSelected()
  }

  function mobilePaste() {
    if (state.clipboardHtml) {
      pasteFromHTML(state.clipboardHtml)
    }
  }

  function commitMove(originals: Map<string, Vector>) {
    const finals = new Map<string, Vector>()
    for (const [id] of originals) {
      const n = graph.getNode(id)
      if (n) finals.set(id, { x: n.x, y: n.y })
    }
    undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
      }
    })
  }

  function commitMoveWithReparent(
    originals: Map<string, { x: number; y: number; parentId: string }>
  ) {
    const finals = new Map<string, { x: number; y: number; parentId: string }>()
    for (const [id] of originals) {
      const n = graph.getNode(id)
      if (n) finals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? state.currentPageId })
    }
    undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          graph.reparentNode(id, pos.parentId)
          graph.updateNode(id, { x: pos.x, y: pos.y })
          runLayoutForNode(id)
        }
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          graph.reparentNode(id, pos.parentId)
          graph.updateNode(id, { x: pos.x, y: pos.y })
          runLayoutForNode(id)
        }
      }
    })
  }

  function snapshotPage(): Map<string, SceneNode> {
    const snapshot = new Map<string, SceneNode>()
    const walk = (id: string) => {
      const node = graph.getNode(id)
      if (!node) return
      snapshot.set(id, structuredClone(node))
      for (const childId of node.childIds) walk(childId)
    }
    walk(state.currentPageId)
    return snapshot
  }

  function restorePageFromSnapshot(snapshot: Map<string, SceneNode>) {
    const page = graph.getNode(state.currentPageId)
    if (!page) return

    for (const childId of page.childIds.slice()) {
      graph.deleteNode(childId)
    }

    const pageSnap = snapshot.get(state.currentPageId)
    if (pageSnap) page.childIds = [...pageSnap.childIds]

    for (const [id, snap] of snapshot) {
      if (id === state.currentPageId) continue
      graph.nodes.set(id, structuredClone(snap))
    }

    graph.clearAbsPosCache()
    computeAllLayouts(graph, state.currentPageId)
    state.selectedIds = new Set()
    state.hoveredNodeId = null
    requestRender()
  }

  function pushUndoEntry(entry: UndoEntry) {
    undo.push(entry)
  }

  function commitResize(nodeId: string, origRect: Rect) {
    const node = graph.getNode(nodeId)
    if (!node) return
    const finalRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    undo.push({
      label: 'Resize',
      forward: () => {
        graph.updateNode(nodeId, finalRect)
        runLayoutForNode(nodeId)
      },
      inverse: () => {
        graph.updateNode(nodeId, origRect)
        runLayoutForNode(nodeId)
      }
    })
  }

  function commitRotation(nodeId: string, origRotation: number) {
    const node = graph.getNode(nodeId)
    if (!node) return
    const finalRotation = node.rotation
    undo.push({
      label: 'Rotate',
      forward: () => {
        graph.updateNode(nodeId, { rotation: finalRotation })
      },
      inverse: () => {
        graph.updateNode(nodeId, { rotation: origRotation })
      }
    })
  }

  function commitNodeUpdate(nodeId: string, previous: Partial<SceneNode>, label = 'Update') {
    const node = graph.getNode(nodeId)
    if (!node) return
    const current = Object.fromEntries(
      (Object.keys(previous) as (keyof SceneNode)[]).map((key) => [key, node[key]])
    ) as Partial<SceneNode>
    undo.push({
      label,
      forward: () => {
        graph.updateNode(nodeId, current)
        runLayoutForNode(nodeId)
      },
      inverse: () => {
        graph.updateNode(nodeId, previous)
        runLayoutForNode(nodeId)
      }
    })
  }

  function undoAction() {
    undo.undo()
    validateEnteredContainer()
  }

  function redoAction() {
    undo.redo()
    validateEnteredContainer()
    requestRender()
  }

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - state.panX) / state.zoom,
      y: (sy - state.panY) / state.zoom
    }
  }

  function applyZoom(delta: number, centerX: number, centerY: number) {
    const factor = Math.min(
      ZOOM_SCALE_MAX,
      Math.max(ZOOM_SCALE_MIN, Math.exp(-delta / ZOOM_DIVISOR))
    )
    const newZoom = Math.max(0.02, Math.min(256, state.zoom * factor))
    state.panX = centerX - (centerX - state.panX) * (newZoom / state.zoom)
    state.panY = centerY - (centerY - state.panY) * (newZoom / state.zoom)
    state.zoom = newZoom
    requestRepaint()
  }

  function pan(dx: number, dy: number) {
    state.panX += dx
    state.panY += dy
    requestRepaint()
  }

  function zoomToBounds(minX: number, minY: number, maxX: number, maxY: number) {
    const padding = 80
    const w = maxX - minX + padding * 2
    const h = maxY - minY + padding * 2

    const viewW = window.innerWidth
    const viewH = window.innerHeight
    const zoom = Math.min(viewW / w, viewH / h, 1)

    state.zoom = zoom
    state.panX = (viewW - w * zoom) / 2 - minX * zoom + padding * zoom
    state.panY = (viewH - h * zoom) / 2 - minY * zoom + padding * zoom
    requestRepaint()
  }

  function zoomToFit() {
    const nodes = graph.getChildren(state.currentPageId)
    if (nodes.length === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    }

    zoomToBounds(minX, minY, maxX, maxY)
  }

  function zoomTo100() {
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    const centerX = (-state.panX + viewW / 2) / state.zoom
    const centerY = (-state.panY + viewH / 2) / state.zoom

    state.zoom = 1
    state.panX = viewW / 2 - centerX
    state.panY = viewH / 2 - centerY
    requestRepaint()
  }

  function zoomToSelection() {
    if (state.selectedIds.size === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of state.selectedIds) {
      const n = graph.getNode(id)
      if (!n) continue
      const abs = graph.getAbsolutePosition(id)
      minX = Math.min(minX, abs.x)
      minY = Math.min(minY, abs.y)
      maxX = Math.max(maxX, abs.x + n.width)
      maxY = Math.max(maxY, abs.y + n.height)
    }
    if (minX === Infinity) return

    zoomToBounds(minX, minY, maxX, maxY)
  }

  return {
    get graph() {
      return graph
    },
    get renderer() {
      return _renderer
    },
    get textEditor() {
      return _textEditor
    },
    undo,
    state,
    selectedNodes,
    selectedNode,
    layerTree,
    requestRender,
    requestRepaint,
    flashNodes,
    aiMarkActive,
    aiMarkDone,
    aiFlashDone,
    aiClearAll,
    setTool,
    select,
    clearSelection,
    enterContainer,
    exitContainer,
    validateEnteredContainer,
    selectAll,
    setMarquee,
    setSnapGuides,
    setRotationPreview,
    setHoveredNode,
    setDropTarget,
    setLayoutInsertIndicator,
    reorderInAutoLayout,
    reparentNodes,
    reorderChildWithUndo,
    penAddVertex,
    penSetDragTangent,
    penSetClosingToFirst,
    penCommit,
    penCancel,
    startTextEditing,
    commitTextEdit,
    openFigFile,
    saveFigFile,
    setCanvasKit,
    saveFigFileAs,
    renderExportImage,
    exportSelection,
    updateNode,
    setLayoutMode,
    wrapInAutoLayout,
    groupSelected,
    ungroupSelected,
    createComponentFromSelection,
    createComponentSetFromComponents,
    createInstanceFromComponent,
    detachInstance,
    goToMainComponent,
    bringToFront,
    sendToBack,
    toggleProfiler,
    toggleVisibility,
    toggleLock,
    moveToPage,
    renameNode,
    createShape,
    storeImage,
    placeImageFiles,
    adoptNodesIntoSection,
    duplicateSelected,
    writeCopyData,
    pasteFromHTML,
    renderJSXWithUndo,
    mobileCopy,
    mobileCut,
    mobilePaste,
    deleteSelected,
    commitMove,
    commitMoveWithReparent,
    commitResize,
    commitRotation,
    commitNodeUpdate,
    updateNodeWithUndo,
    undoAction,
    redoAction,
    snapshotPage,
    restorePageFromSnapshot,
    pushUndoEntry,
    screenToCanvas,
    applyZoom,
    pan,
    zoomToFit,
    zoomTo100,
    zoomToSelection,
    isTopLevel,
    switchPage,
    addPage,
    deletePage,
    renamePage
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
