import { shallowReactive, shallowRef, computed, watch } from 'vue'

import {
  IS_TAURI,
  DEFAULT_SHAPE_FILL,
  DEFAULT_FRAME_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE,
  CANVAS_BG_COLOR,
  ZOOM_SENSITIVITY
} from '@/constants'
import {
  parseFigmaClipboard,
  importClipboardNodes,
  figmaNodesBounds,
  parseOpenPencilClipboard,
  buildFigmaClipboardHTML,
  buildOpenPencilClipboardHTML,
  prefetchFigmaSchema
} from '@/engine/clipboard'
import { exportFigFile } from '@/engine/fig-export'
import { computeLayout, computeAllLayouts } from '@/engine/layout'
import { renderNodesToImage } from '@/engine/render-image'
import { SceneGraph } from '@/engine/scene-graph'
import { TextEditor } from '@/engine/text-editor'
import { UndoManager } from '@/engine/undo'
import { computeVectorBounds } from '@/engine/vector'
import { readFigFile } from '@/kiwi/fig-file'

import type { ExportFormat } from '@/engine/render-image'
import type {
  SceneNode,
  NodeType,
  Fill,
  LayoutMode,
  VectorVertex,
  VectorSegment,
  VectorRegion,
  VectorNetwork
} from '@/engine/scene-graph'
import type { SnapGuide } from '@/engine/snap'
import type { Color, Rect } from '@/types'

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

export const TOOL_SHORTCUTS: Record<string, Tool> = {
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
  let _ck: import('canvaskit-wasm').CanvasKit | null = null
  let _renderer: import('@/engine/renderer').SkiaRenderer | null = null
  let _textEditor: TextEditor | null = null

  prefetchFigmaSchema()

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
      dragTangent: { x: number; y: number } | null
      closingToFirst: boolean
    } | null,
    penCursorX: null as number | null,
    penCursorY: null as number | null,
    remoteCursors: [] as Array<{
      name: string
      color: Color
      x: number
      y: number
      selection?: string[]
    }>,
    showUI: matchMedia('(min-width: 768px)').matches,
    documentName: 'Untitled' as string,
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR } as Color,
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    sceneVersion: 0
  })

  const AUTOSAVE_DELAY = 3000

  watch(
    () => state.sceneVersion,
    (version) => {
      if (version === savedVersion) return
      if (!fileHandle && !filePath) return
      clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(async () => {
        if (state.sceneVersion === savedVersion) return
        try {
          await writeFile(await buildFigFile())
        } catch {
          // silently fail — user can still save manually
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

  function isTopLevel(parentId: string | null): boolean {
    return !parentId || parentId === graph.rootId || parentId === state.currentPageId
  }

  function switchPage(pageId: string) {
    const page = graph.getNode(pageId)
    if (!page || page.type !== 'CANVAS') return

    // Save current viewport
    pageViewports.set(state.currentPageId, {
      panX: state.panX,
      panY: state.panY,
      zoom: state.zoom,
      pageColor: { ...state.pageColor }
    })

    // Switch
    state.currentPageId = pageId
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

    requestRender()
  }

  function addPage(name?: string) {
    const pages = graph.getPages()
    const pageName = name ?? `Page ${pages.length + 1}`
    const page = graph.addPage(pageName)
    switchPage(page.id)
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
      switchPage(remaining[newIdx].id)
    }
    requestRender()
  }

  function renamePage(pageId: string, name: string) {
    graph.updateNode(pageId, { name })
    requestRender()
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

  function reorderInAutoLayout(nodeId: string, parentId: string, insertIndex: number) {
    const parent = graph.getNode(parentId)
    if (!parent || parent.layoutMode === 'NONE') return

    const node = graph.getNode(nodeId)
    if (!node) return

    // Convert position if coming from different parent
    if (node.parentId !== parentId) {
      const absPos = graph.getAbsolutePosition(nodeId)
      const parentAbs = graph.getAbsolutePosition(parentId)
      graph.updateNode(nodeId, { x: absPos.x - parentAbs.x, y: absPos.y - parentAbs.y })
    }

    graph.reorderChild(nodeId, parentId, insertIndex)
    computeLayout(graph, parentId)
    runLayoutForNode(parentId)
    requestRender()
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
    requestRender()
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
          requestRender()
        },
        inverse: () => {
          graph.updateNode(result.nodeId, { text: prevText })
          requestRender()
        }
      })
    }
    requestRender()
  }

  async function openFigFile(file: File, handle?: FileSystemFileHandle, path?: string) {
    try {
      const imported = await readFigFile(file)
      graph = imported
      computeAllLayouts(graph)
      undo.clear()
      pageViewports.clear()
      fileHandle = handle ?? null
      filePath = path ?? null
      state.documentName = file.name.replace(/\.fig$/i, '')
      downloadName = file.name
      state.selectedIds = new Set()
      const firstPage = graph.getPages()[0]
      state.currentPageId = firstPage?.id ?? graph.rootId
      state.panX = 0
      state.panY = 0
      state.zoom = 1
      state.pageColor = { ...CANVAS_BG_COLOR }
      requestRender()
    } catch (e) {
      console.error('Failed to open .fig file:', e)
    }
  }

  function setCanvasKit(
    ck: import('canvaskit-wasm').CanvasKit,
    renderer: import('@/engine/renderer').SkiaRenderer
  ) {
    _ck = ck
    _renderer = renderer
    _textEditor = new TextEditor(ck)
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
              description: `${format} image`,
              accept: { [exportImageMime(format)]: [ext] }
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

    downloadBlob(new Uint8Array(data), fileName, exportImageMime(format))
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

  function updateNode(id: string, changes: Partial<SceneNode>) {
    graph.updateNode(id, changes)
    if ('vectorNetwork' in changes) {
      _renderer?.invalidateVectorPath(id)
    }
    runLayoutForNode(id)
    syncIfInsideComponent(id)
    requestRender()
  }

  function syncIfInsideComponent(nodeId: string) {
    let current = graph.getNode(nodeId)
    while (current) {
      if (current.type === 'COMPONENT') {
        graph.syncInstances(current.id)
        return
      }
      current = current.parentId ? graph.getNode(current.parentId) : undefined
    }
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    const node = graph.getNode(id)
    if (!node) return
    const previous: Partial<SceneNode> = {}
    for (const key of Object.keys(changes) as (keyof SceneNode)[]) {
      ;(previous as Record<string, unknown>)[key] = node[key]
    }
    graph.updateNode(id, changes)
    runLayoutForNode(id)
    syncIfInsideComponent(id)
    undo.push({
      label,
      forward: () => {
        graph.updateNode(id, changes)
        runLayoutForNode(id)
        syncIfInsideComponent(id)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(id, previous)
        runLayoutForNode(id)
        syncIfInsideComponent(id)
        requestRender()
      }
    })
    requestRender()
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
      width: node.width,
      height: node.height
    }

    const updates: Partial<SceneNode> = { layoutMode: mode }
    if (mode !== 'NONE' && node.layoutMode === 'NONE') {
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

    const finalState: Partial<SceneNode> = {}
    const updated = graph.getNode(id)
    if (!updated) return
    for (const key of Object.keys(previous) as (keyof SceneNode)[]) {
      ;(finalState as Record<string, unknown>)[key] = updated[key]
    }

    undo.push({
      label: mode === 'NONE' ? 'Remove auto layout' : 'Add auto layout',
      forward: () => {
        graph.updateNode(id, finalState)
        if (mode !== 'NONE') computeLayout(graph, id)
        runLayoutForNode(id)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(id, previous)
        runLayoutForNode(id)
        requestRender()
      }
    })
    requestRender()
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

    const frame = graph.createNode('FRAME', parentId, {
      name: 'Frame',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width: maxX - minX,
      height: maxY - minY,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      primaryAxisAlign: 'MIN',
      counterAxisAlign: 'MIN',
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }]
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
        requestRender()
      },
      inverse: () => {
        // Move children back to original parent and delete frame
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, orig.parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(frameId)
        state.selectedIds = prevSelection
        requestRender()
      }
    })
    requestRender()
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
        requestRender()
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(groupId)
        state.selectedIds = prevSelection
        requestRender()
      }
    })
    requestRender()
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
            requestRender()
          },
          inverse: () => {
            graph.updateNode(node.id, { type: prevType })
            state.selectedIds = prevSelection
            requestRender()
          }
        })
        requestRender()
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
        requestRender()
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(componentId)
        state.selectedIds = prevSelection
        requestRender()
      }
    })
    requestRender()
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
        requestRender()
      },
      inverse: () => {
        for (const orig of origPositions) {
          graph.reparentNode(orig.id, parentId)
          graph.updateNode(orig.id, { x: orig.x, y: orig.y })
        }
        graph.deleteNode(setId)
        state.selectedIds = prevSelection
        requestRender()
      }
    })
    requestRender()
  }

  function createInstanceFromComponent(componentId: string, x?: number, y?: number) {
    const component = graph.getNode(componentId)
    if (!component || component.type !== 'COMPONENT') return null

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
        requestRender()
      },
      inverse: () => {
        graph.deleteNode(instanceId)
        state.selectedIds = new Set([componentId])
        requestRender()
      }
    })
    requestRender()
    return instanceId
  }

  function detachInstance() {
    const node = selectedNode.value
    if (!node || node.type !== 'INSTANCE') return

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
        requestRender()
      }
    })
    requestRender()
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
      switchPage(current.id)
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
    if (!node || node.type !== 'GROUP') return

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
        requestRender()
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
        requestRender()
      }
    })
    requestRender()
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

  function toggleVisibility() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, { visible: !node.visible })
    }
    requestRender()
  }

  function toggleLock() {
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
      graph.updateNode(id, { locked: !node.locked })
    }
    requestRender()
  }

  function moveToPage(pageId: string) {
    const targetPage = graph.getNode(pageId)
    if (!targetPage || targetPage.type !== 'CANVAS') return
    const ids = [...state.selectedIds]
    for (const id of ids) {
      graph.reparentNode(id, pageId)
    }
    clearSelection()
    requestRender()
  }

  function renameNode(id: string, name: string) {
    graph.updateNode(id, { name })
    requestRender()
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
        requestRender()
      },
      inverse: () => {
        graph.deleteNode(id)
        const next = new Set(state.selectedIds)
        next.delete(id)
        state.selectedIds = next
        requestRender()
      }
    })
    requestRender()
    return id
  }

  function adoptNodesIntoSection(sectionId: string) {
    const section = graph.getNode(sectionId)
    if (!section || section.type !== 'SECTION') return

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
        requestRender()
      },
      inverse: () => {
        for (const op of undoOps) {
          graph.reparentNode(op.id, op.oldParent)
          graph.updateNode(op.id, { x: op.oldX, y: op.oldY })
        }
        requestRender()
      }
    })
    requestRender()
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
          requestRender()
        },
        inverse: () => {
          for (const { id } of snapshots) graph.deleteNode(id)
          state.selectedIds = prevSelection
          requestRender()
        }
      })
      requestRender()
    }
  }

  function writeCopyData(clipboardData: DataTransfer) {
    const nodes = selectedNodes.value
    if (nodes.length === 0) return

    const names = nodes.map((n) => n.name).join('\n')
    const renderer = _renderer
    const textPicBuilder = renderer
      ? (node: SceneNode) => renderer.buildTextPicture(node)
      : undefined
    const internalHtml = buildOpenPencilClipboardHTML(nodes, graph, textPicBuilder)
    const figmaHtml = buildFigmaClipboardHTML(nodes, graph)

    const html = figmaHtml ? figmaHtml + internalHtml : internalHtml
    clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
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

  function pasteFromHTML(html: string) {
    const ownNodes = parseOpenPencilClipboard(html)
    if (ownNodes) {
      pasteOpenPencilNodes(ownNodes)
      return
    }

    parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const bounds = figmaNodesBounds(figma.nodes)
        const viewCenterX = (-state.panX + window.innerWidth / 2) / state.zoom
        const viewCenterY = (-state.panY + window.innerHeight / 2) / state.zoom
        const offsetX = bounds ? viewCenterX - (bounds.x + bounds.w / 2) : 0
        const offsetY = bounds ? viewCenterY - (bounds.y + bounds.h / 2) : 0

        const prevSelection = new Set(state.selectedIds)
        const created = importClipboardNodes(
          figma.nodes,
          graph,
          state.currentPageId,
          offsetX,
          offsetY,
          figma.blobs
        )
        if (created.length > 0) {
          computeAllLayouts(graph)
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
              computeAllLayouts(graph)
              state.selectedIds = new Set(created)
              requestRender()
            },
            inverse: () => {
              for (const id of [...created].reverse()) graph.deleteNode(id)
              computeAllLayouts(graph)
              state.selectedIds = prevSelection
              requestRender()
            }
          })
          requestRender()
        }
      }
    })
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    parentId?: string
  ) {
    const target = parentId ?? state.currentPageId
    const prevSelection = new Set(state.selectedIds)
    const newIds: string[] = []
    const created: Array<{ id: string; parentId: string; snapshot: SceneNode }> = []

    function createTree(src: SceneNode & { children?: SceneNode[] }, pid: string, isTop: boolean) {
      const { id: _srcId, parentId: _srcParent, childIds: _srcChildren, ...rest } = src
      const node = graph.createNode(src.type, pid, {
        ...rest,
        x: src.x + (isTop ? 20 : 0),
        y: src.y + (isTop ? 20 : 0)
      })
      created.push({ id: node.id, parentId: pid, snapshot: { ...node } })
      if (isTop) newIds.push(node.id)
      if (src.children) {
        for (const child of src.children) {
          createTree(child, node.id, false)
        }
      }
    }

    for (const src of nodes) {
      createTree(src, target, true)
    }
    if (newIds.length > 0) {
      state.selectedIds = new Set(newIds)
      undo.push({
        label: 'Paste',
        forward: () => {
          for (const { snapshot, parentId: pid } of created) {
            graph.createNode(snapshot.type, pid, snapshot)
          }
          state.selectedIds = new Set(newIds)
          requestRender()
        },
        inverse: () => {
          for (const { id } of [...created].reverse()) graph.deleteNode(id)
          state.selectedIds = prevSelection
          requestRender()
        }
      })
      requestRender()
    }
  }

  function deleteSelected() {
    const entries: Array<{ id: string; parentId: string; snapshot: SceneNode; index: number }> = []
    for (const id of state.selectedIds) {
      const node = graph.getNode(id)
      if (!node) continue
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
        requestRender()
      },
      inverse: () => {
        for (const { snapshot, parentId, index } of [...entries].reverse()) {
          graph.createNode(snapshot.type, parentId, snapshot)
          if (index >= 0) {
            graph.reorderChild(snapshot.id, parentId, index)
          }
        }
        state.selectedIds = prevSelection
        requestRender()
      }
    })
    clearSelection()
    requestRender()
  }

  function commitMove(originals: Map<string, { x: number; y: number }>) {
    const finals = new Map<string, { x: number; y: number }>()
    for (const [id] of originals) {
      const n = graph.getNode(id)
      if (n) finals.set(id, { x: n.x, y: n.y })
    }
    for (const [id] of finals) syncIfInsideComponent(id)
    undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
        for (const [id] of finals) syncIfInsideComponent(id)
        requestRender()
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
        for (const [id] of originals) syncIfInsideComponent(id)
        requestRender()
      }
    })
  }

  function commitResize(nodeId: string, origRect: Rect) {
    const node = graph.getNode(nodeId)
    if (!node) return
    const finalRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    syncIfInsideComponent(nodeId)
    undo.push({
      label: 'Resize',
      forward: () => {
        graph.updateNode(nodeId, finalRect)
        runLayoutForNode(nodeId)
        syncIfInsideComponent(nodeId)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(nodeId, origRect)
        runLayoutForNode(nodeId)
        syncIfInsideComponent(nodeId)
        requestRender()
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
        requestRender()
      },
      inverse: () => {
        graph.updateNode(nodeId, { rotation: origRotation })
        requestRender()
      }
    })
  }

  function commitNodeUpdate(nodeId: string, previous: Partial<SceneNode>, label = 'Update') {
    const node = graph.getNode(nodeId)
    if (!node) return
    const current: Partial<SceneNode> = {}
    for (const key of Object.keys(previous) as (keyof SceneNode)[]) {
      ;(current as Record<string, unknown>)[key] = node[key]
    }
    undo.push({
      label,
      forward: () => {
        graph.updateNode(nodeId, current)
        runLayoutForNode(nodeId)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(nodeId, previous)
        runLayoutForNode(nodeId)
        requestRender()
      }
    })
  }

  function undoAction() {
    undo.undo()
    requestRender()
  }

  function redoAction() {
    undo.redo()
    requestRender()
  }

  function screenToCanvas(sx: number, sy: number) {
    return {
      x: (sx - state.panX) / state.zoom,
      y: (sy - state.panY) / state.zoom
    }
  }

  function applyZoom(delta: number, centerX: number, centerY: number) {
    const factor = Math.pow(ZOOM_SENSITIVITY, delta)
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

    const padding = 80
    const w = maxX - minX + padding * 2
    const h = maxY - minY + padding * 2

    // Will be set by canvas composable
    const viewW = 800
    const viewH = 600
    const zoom = Math.min(viewW / w, viewH / h, 1)

    state.zoom = zoom
    state.panX = (viewW - w * zoom) / 2 - minX * zoom + padding * zoom
    state.panY = (viewH - h * zoom) / 2 - minY * zoom + padding * zoom
    requestRepaint()
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
    setTool,
    select,
    clearSelection,
    selectAll,
    setMarquee,
    setSnapGuides,
    setRotationPreview,
    setHoveredNode,
    setDropTarget,
    setLayoutInsertIndicator,
    reorderInAutoLayout,
    reparentNodes,
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
    toggleVisibility,
    toggleLock,
    moveToPage,
    renameNode,
    createShape,
    adoptNodesIntoSection,
    duplicateSelected,
    writeCopyData,
    pasteFromHTML,
    deleteSelected,
    commitMove,
    commitResize,
    commitRotation,
    commitNodeUpdate,
    updateNodeWithUndo,
    undoAction,
    redoAction,
    screenToCanvas,
    applyZoom,
    pan,
    zoomToFit,
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
