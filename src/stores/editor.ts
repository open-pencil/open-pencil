import { useDebounceFn } from '@vueuse/core'
import { shallowReactive, shallowRef, computed, watch, triggerRef } from 'vue'

import { IS_TAURI } from '@/constants'
import { loadFont } from '@/engine/fonts'
import { toast } from '@/utils/toast'
import {
  breakAtVertex,
  BUILTIN_IO_FORMATS,
  cloneVectorNetwork,
  computeAccurateBounds,
  createDefaultEditorState,
  createEditor,
  deleteVertex,
  exportFigFile,
  findAllHandles,
  findOppositeHandle,
  IORegistry,
  mirrorHandle,
  nearestPointOnNetwork,
  readFigFile,
  removeVertex,
  renderNodesToImage,
  SceneGraph,
  splitSegmentAt,
  prefetchFigmaSchema
} from '@open-pencil/core'

import type {
  EditorState,
  ExportRequest,
  Fill,
  IOFormatAdapter,
  RasterExportFormat,
  Rect,
  SceneNode,
  Vector,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex,
  Tool
} from '@open-pencil/core'

export type { Tool } from '@open-pencil/core'
export type { EditorToolDef as ToolDef } from '@open-pencil/core'
export { EDITOR_TOOLS as TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core'

export function createEditorStore(initialGraph?: SceneGraph) {
  const graph = initialGraph ?? new SceneGraph()

  const state = shallowReactive<
    Omit<EditorState, 'penState'> & {
      penState: {
        vertices: VectorVertex[]
        segments: VectorSegment[]
        dragTangent: Vector | null
        oppositeDragTangent: Vector | null
        closingToFirst: boolean
        pendingClose?: boolean
        resumingNodeId?: string
        resumedFills?: Fill[]
        resumedStrokes?: SceneNode['strokes']
      } | null
      showUI: boolean
      showRulers: boolean
      showRemoteCursors: boolean
      activeRibbonTab: 'panels' | 'code' | 'ai'
      panelMode: 'layers' | 'design'
      actionToast: string | null
      mobileDrawerSnap: 'closed' | 'half' | 'full'
      clipboardHtml: string
      autosaveEnabled: boolean
      cursorCanvasX: number | null
      cursorCanvasY: number | null
      nodeEditState: {
        nodeId: string
        origNetwork: VectorNetwork
        origBounds: Rect
        vertices: VectorVertex[]
        segments: VectorSegment[]
        regions: VectorRegion[]
        selectedVertexIndices: Set<number>
        draggedHandleInfo: {
          vertexIndex: number
          handleType: 'tangentStart' | 'tangentEnd'
          segmentIndex: number
        } | null
        /** Set of selected handles as "segIdx:tangentField" strings */
        selectedHandles: Set<string>
        hoveredHandleInfo: {
          segmentIndex: number
          tangentField: 'tangentStart' | 'tangentEnd'
        } | null
      } | null
    }
  >({
    ...createDefaultEditorState(graph.getPages()[0].id),
    showUI: true,
    showRulers: true,
    showRemoteCursors: true,
    activeRibbonTab: 'panels',
    panelMode: 'design',
    actionToast: null,
    mobileDrawerSnap: 'closed',
    clipboardHtml: '',
    autosaveEnabled: false,
    cursorCanvasX: null,
    cursorCanvasY: null,
    nodeEditState: null
  })

  const editor = createEditor({ graph, state, loadFont, skipInitialGraphSetup: !!initialGraph })
  const io = new IORegistry(BUILTIN_IO_FORMATS)

  if (initialGraph) {
    editor.subscribeToGraph()
  }

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

  // ─── Tool override (commit pen on tool switch) ────────────────

  function setTool(tool: Tool) {
    // If switching away from PEN while drawing, commit the open path
    // except when switching to HAND (e.g. holding Space to pan)
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    state.activeTool = tool
  }

  // ─── Pen resume (vector editor) ────────────────────────────────

  function penResumeOnPath(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const vn = node.vectorNetwork

    // Convert to absolute coords
    const absVertices: VectorVertex[] = vn.vertices.map((v) => ({
      ...v,
      x: v.x + node.x,
      y: v.y + node.y
    }))

    state.penState = {
      vertices: absVertices,
      segments: vn.segments.map((s) => ({
        ...s,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })),
      dragTangent: null,
      oppositeDragTangent: null,
      closingToFirst: false,
      pendingClose: false,
      resumingNodeId: nodeId,
      resumedFills: [...node.fills],
      resumedStrokes: [...node.strokes]
    }

    // Remove the original node (will be recreated on commit)
    graph.deleteNode(nodeId)
    state.selectedIds = new Set()
    state.activeTool = 'PEN'
    editor.requestRender()
  }

  /** Walk a chain from `start` and return the last vertex reached. */
  function walkChainToEnd(segments: { start: number; end: number }[], start: number): number {
    let current = start
    const visited = new Set<number>([start])
    for (;;) {
      let found = false
      for (const seg of segments) {
        let next = -1
        if (seg.start === current && !visited.has(seg.end)) next = seg.end
        else if (seg.end === current && !visited.has(seg.start)) next = seg.start
        if (next === -1) continue
        visited.add(next)
        current = next
        found = true
        break
      }
      if (!found) break
    }
    return current
  }

  /** Walk from `start` and return ordered vertices/segments (remapped to 0-based indices). */
  function walkChainOrdered(
    absVertices: VectorVertex[],
    absSegments: VectorSegment[],
    start: number
  ): { orderedVertices: VectorVertex[]; orderedSegments: VectorSegment[] } {
    const orderedVertices: VectorVertex[] = []
    const orderedSegments: VectorSegment[] = []
    const visited = new Set<number>()
    let current = start

    orderedVertices.push(absVertices[current])
    visited.add(current)

    for (;;) {
      let foundSeg = false
      for (const seg of absSegments) {
        let next = -1
        let isForward = false
        if (seg.start === current && !visited.has(seg.end)) {
          next = seg.end
          isForward = true
        } else if (seg.end === current && !visited.has(seg.start)) {
          next = seg.start
          isForward = false
        }
        if (next === -1) continue

        const fromIdx = orderedVertices.length - 1
        orderedVertices.push(absVertices[next])
        const toIdx = orderedVertices.length - 1

        orderedSegments.push({
          start: fromIdx,
          end: toIdx,
          tangentStart: isForward ? { ...seg.tangentStart } : { ...seg.tangentEnd },
          tangentEnd: isForward ? { ...seg.tangentEnd } : { ...seg.tangentStart }
        })

        visited.add(next)
        current = next
        foundSeg = true
        break
      }
      if (!foundSeg) break
    }
    return { orderedVertices, orderedSegments }
  }

  /**
   * Resume pen drawing from an endpoint of an existing VECTOR node.
   * Reorders vertices/segments so the endpoint is the last vertex,
   * then sets up penState for continuing the drawing.
   */
  function penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const vn = node.vectorNetwork

    // Convert to absolute coords
    const absVertices: VectorVertex[] = vn.vertices.map((v) => ({
      ...v,
      x: v.x + node.x,
      y: v.y + node.y
    }))
    const absSegments: VectorSegment[] = vn.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    }))

    // Find the OTHER endpoint, then walk from it so the clicked one ends up last.
    const otherEnd = walkChainToEnd(absSegments, endpointVertexIndex)
    const { orderedVertices, orderedSegments } = walkChainOrdered(
      absVertices,
      absSegments,
      otherEnd
    )

    state.penState = {
      vertices: orderedVertices,
      segments: orderedSegments,
      dragTangent: null,
      oppositeDragTangent: null,
      closingToFirst: false,
      pendingClose: false,
      resumingNodeId: nodeId,
      resumedFills: [...node.fills],
      resumedStrokes: [...node.strokes]
    }

    graph.deleteNode(nodeId)
    state.selectedIds = new Set()
    state.activeTool = 'PEN'
    editor.requestRender()
  }

  // ─── Node edit mode (vector geometry) ──────────────────────────

  const NODE_EDIT_HIT_THRESHOLD = 8

  function getNodeEditState() {
    return state.nodeEditState
  }

  function setNodeEditNetwork(es: NonNullable<typeof state.nodeEditState>, network: VectorNetwork) {
    es.vertices = network.vertices.map((v) => ({ ...v }))
    es.segments = network.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    }))
    es.regions = network.regions.map((r) => ({
      windingRule: r.windingRule,
      loops: r.loops.map((l) => [...l])
    }))
  }

  function getLiveNetwork(es: NonNullable<typeof state.nodeEditState>): VectorNetwork {
    return {
      vertices: es.vertices.map((v) => ({ ...v })),
      segments: es.segments.map((s) => ({
        ...s,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })),
      regions: es.regions.map((r) => ({
        windingRule: r.windingRule,
        loops: r.loops.map((l) => [...l])
      }))
    }
  }

  function applyNodeEditToNode(es: NonNullable<typeof state.nodeEditState>) {
    const node = graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') return

    const live = getLiveNetwork(es)
    const bounds = computeAccurateBounds(live)
    const relativeNetwork: VectorNetwork = {
      vertices: live.vertices.map((v) => ({
        ...v,
        x: v.x - bounds.x,
        y: v.y - bounds.y
      })),
      segments: live.segments,
      regions: live.regions
    }

    graph.updateNode(node.id, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      vectorNetwork: relativeNetwork
    })
    editor.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = node.vectorNetwork.vertices.map((v) => ({
      ...v,
      x: v.x + node.x,
      y: v.y + node.y
    }))

    state.nodeEditState = {
      nodeId,
      origNetwork: cloneVectorNetwork(node.vectorNetwork),
      origBounds: { x: node.x, y: node.y, width: node.width, height: node.height },
      vertices: absVertices,
      segments: node.vectorNetwork.segments.map((s) => ({
        ...s,
        tangentStart: { ...s.tangentStart },
        tangentEnd: { ...s.tangentEnd }
      })),
      regions: node.vectorNetwork.regions.map((r) => ({
        windingRule: r.windingRule,
        loops: r.loops.map((l) => [...l])
      })),
      selectedVertexIndices: new Set(),
      draggedHandleInfo: null,
      selectedHandles: new Set(),
      hoveredHandleInfo: null
    }

    state.selectedIds = new Set([nodeId])
    editor.requestRender()
  }

  function exitNodeEditMode(commit: boolean) {
    const es = getNodeEditState()
    if (!es) return

    const node = graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      state.nodeEditState = null
      editor.requestRender()
      return
    }

    if (commit) {
      applyNodeEditToNode(es)
    } else {
      graph.updateNode(es.nodeId, {
        x: es.origBounds.x,
        y: es.origBounds.y,
        width: es.origBounds.width,
        height: es.origBounds.height,
        vectorNetwork: cloneVectorNetwork(es.origNetwork)
      })
      editor.requestRender()
    }

    state.nodeEditState = null
  }

  function nodeEditSelectVertex(vertexIndex: number, addToSelection: boolean) {
    const es = getNodeEditState()
    if (!es) return
    if (addToSelection) {
      const next = new Set(es.selectedVertexIndices)
      if (next.has(vertexIndex)) next.delete(vertexIndex)
      else next.add(vertexIndex)
      es.selectedVertexIndices = next
    } else {
      es.selectedVertexIndices = new Set([vertexIndex])
    }
    editor.requestRepaint()
  }

  type HandleInfo = {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
    neighborIndex: number
  }

  /** Resolve the base direction vector for a handle, falling back to neighbor direction. */
  function handleBaseVector(tangent: Vector, neighbor: Vector, origin: Vector): Vector {
    return Math.hypot(tangent.x, tangent.y) > 1e-6
      ? tangent
      : { x: neighbor.x - origin.x, y: neighbor.y - origin.y }
  }

  /** Among sibling handles, find the one most opposite to the active handle direction. */
  function findSisterHandle(
    es: NonNullable<typeof state.nodeEditState>,
    siblings: HandleInfo[],
    activeBase: Vector,
    vertexIndex: number
  ): HandleInfo {
    let sister = siblings[0]
    const activeBaseLen = Math.hypot(activeBase.x, activeBase.y)
    if (activeBaseLen <= 1e-6) return sister

    const activeDir = { x: activeBase.x / activeBaseLen, y: activeBase.y / activeBaseLen }
    let bestDot = Infinity
    for (const s of siblings) {
      const sSeg = es.segments[s.segmentIndex]
      const sVertex = es.vertices[vertexIndex]
      const sNeighbor = es.vertices[s.neighborIndex]
      const sBase = handleBaseVector(sSeg[s.tangentField], sNeighbor, sVertex)
      const sLen = Math.hypot(sBase.x, sBase.y)
      if (sLen < 1e-6) continue
      const sDir = { x: sBase.x / sLen, y: sBase.y / sLen }
      const dot = activeDir.x * sDir.x + activeDir.y * sDir.y
      if (dot < bestDot) {
        bestDot = dot
        sister = s
      }
    }
    return sister
  }

  /** Constrain a tangent to be continuous with the sister handle. Returns the constrained vector, or null if no constraint applied. */
  function constrainContinuousTangent(
    es: NonNullable<typeof state.nodeEditState>,
    newTangent: Vector,
    active: HandleInfo,
    all: HandleInfo[],
    seg: VectorSegment,
    tangentField: 'tangentStart' | 'tangentEnd',
    vertexIndex: number,
    vertex: VectorVertex
  ): Vector | null {
    const siblings = all.filter(
      (h) => !(h.segmentIndex === active.segmentIndex && h.tangentField === active.tangentField)
    )
    if (siblings.length === 0) return null

    const activeNeighbor = es.vertices[active.neighborIndex]
    const activeBase = handleBaseVector(seg[tangentField], activeNeighbor, vertex)
    const sister = findSisterHandle(es, siblings, activeBase, vertexIndex)

    const sisterSeg = es.segments[sister.segmentIndex]
    const sisterNeighbor = es.vertices[sister.neighborIndex]
    const sisterBase = handleBaseVector(sisterSeg[sister.tangentField], sisterNeighbor, vertex)
    const sisterLen = Math.hypot(sisterBase.x, sisterBase.y)
    if (sisterLen <= 1e-6) return null

    const desiredDir = { x: -sisterBase.x / sisterLen, y: -sisterBase.y / sisterLen }
    const len = Math.max(0, newTangent.x * desiredDir.x + newTangent.y * desiredDir.y)
    vertex.handleMirroring = 'ANGLE'
    return { x: desiredDir.x * len, y: desiredDir.y * len }
  }

  function nodeEditSetHandle(
    segmentIndex: number,
    tangentField: 'tangentStart' | 'tangentEnd',
    newTangent: Vector,
    options?: {
      breakMirroring?: boolean
      continuous?: boolean
      lockDirection?: boolean
    }
  ) {
    const es = getNodeEditState()
    if (!es) return
    const seg = es.segments[segmentIndex]

    const breakMirroring = options?.breakMirroring ?? false
    const continuous = options?.continuous ?? false
    const lockDirection = options?.lockDirection ?? false
    const vertexIndex = tangentField === 'tangentStart' ? seg.start : seg.end
    const vertex = es.vertices[vertexIndex]
    const live = getLiveNetwork(es)

    const all = findAllHandles(live, vertexIndex)
    const active = all.find(
      (h) => h.segmentIndex === segmentIndex && h.tangentField === tangentField
    )

    let applied = { x: newTangent.x, y: newTangent.y }
    if (continuous && active) {
      applied =
        constrainContinuousTangent(
          es,
          newTangent,
          active,
          all,
          seg,
          tangentField,
          vertexIndex,
          vertex
        ) ?? applied
    }

    seg[tangentField] = applied
    const mode = vertex.handleMirroring ?? 'NONE'
    if (lockDirection && mode === 'NONE') {
      seg[tangentField] = { x: newTangent.x, y: newTangent.y }
      editor.requestRepaint()
      return
    }
    if (breakMirroring) {
      vertex.handleMirroring = 'NONE'
      editor.requestRepaint()
      return
    }
    if (mode === 'NONE') {
      editor.requestRepaint()
      return
    }

    const opposite = findOppositeHandle(live, vertexIndex, segmentIndex)
    if (!opposite) {
      editor.requestRepaint()
      return
    }

    const oppositeSeg = es.segments[opposite.segmentIndex]
    const oppositeCurrent = oppositeSeg[opposite.tangentField]
    const oppositeLength =
      mode === 'ANGLE' ? Math.hypot(oppositeCurrent.x, oppositeCurrent.y) : undefined
    const mirrored = mirrorHandle(applied, mode, oppositeLength)
    if (mirrored) {
      oppositeSeg[opposite.tangentField] = mirrored
    }
    editor.requestRepaint()
  }

  function nodeEditBendHandle(
    vertexIndex: number,
    dx: number,
    dy: number,
    independent: boolean,
    targetSegmentIndex: number | null,
    targetTangentField: 'tangentStart' | 'tangentEnd' | null
  ) {
    const es = getNodeEditState()
    if (!es) return
    if (targetSegmentIndex == null || targetTangentField == null) return
    const live = getLiveNetwork(es)
    const handles = findAllHandles(live, vertexIndex)
    if (handles.length === 0) return

    const effectiveTargets = handles.filter(
      (h) => h.segmentIndex === targetSegmentIndex && h.tangentField === targetTangentField
    )
    if (effectiveTargets.length === 0) return

    const primary = { x: dx, y: dy }
    const opposite = independent ? { x: dx, y: dy } : { x: -dx, y: -dy }

    const first = effectiveTargets[0]
    es.segments[first.segmentIndex][first.tangentField] = primary
    for (let i = 1; i < effectiveTargets.length; i++) {
      const h = effectiveTargets[i]
      es.segments[h.segmentIndex][h.tangentField] = primary
    }
    if (!independent) {
      for (const h of handles) {
        if (effectiveTargets.includes(h)) continue
        es.segments[h.segmentIndex][h.tangentField] = opposite
      }
    }

    es.vertices[vertexIndex].handleMirroring = independent ? 'NONE' : 'ANGLE_AND_LENGTH'
    editor.requestRepaint()
  }

  function nodeEditZeroVertexHandles(vertexIndex: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const handles = findAllHandles(live, vertexIndex)
    for (const h of handles) {
      es.segments[h.segmentIndex][h.tangentField] = { x: 0, y: 0 }
    }
    es.vertices[vertexIndex].handleMirroring = 'NONE'
    editor.requestRepaint()
  }

  function nodeEditConnectEndpoints(a: number, b: number) {
    const es = getNodeEditState()
    if (!es || a === b) return
    if (a < 0 || b < 0 || a >= es.vertices.length || b >= es.vertices.length) return

    const removeIndex = a
    const keepIndex = b
    const remap = (idx: number): number => {
      if (idx === removeIndex) return keepIndex
      return idx > removeIndex ? idx - 1 : idx
    }

    const nextVertices = es.vertices.filter((_, idx) => idx !== removeIndex)
    const nextSegments = es.segments
      .map((seg) => ({
        ...seg,
        tangentStart: { ...seg.tangentStart },
        tangentEnd: { ...seg.tangentEnd },
        start: remap(seg.start),
        end: remap(seg.end)
      }))
      .filter((seg) => seg.start !== seg.end)

    setNodeEditNetwork(es, { vertices: nextVertices, segments: nextSegments, regions: [] })
    es.selectedVertexIndices = new Set([remap(keepIndex)])
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditAddVertex(cx: number, cy: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const nearest = nearestPointOnNetwork(cx, cy, live, NODE_EDIT_HIT_THRESHOLD / state.zoom)
    if (!nearest) return
    const split = splitSegmentAt(live, nearest.segmentIndex, nearest.t)
    setNodeEditNetwork(es, split.network)
    es.selectedVertexIndices = new Set([split.newVertexIndex])
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditRemoveVertex(vertexIndex: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const next = removeVertex(live, vertexIndex)
    if (!next) return
    setNodeEditNetwork(es, next)
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditAlignVertices(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max') {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size < 2) return

    const indices = [...es.selectedVertexIndices]
    const prop = axis === 'horizontal' ? 'x' : 'y'

    let lo = Infinity
    let hi = -Infinity
    for (const i of indices) {
      const v = es.vertices[i][prop]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }

    let target = (lo + hi) / 2
    if (align === 'min') target = lo
    else if (align === 'max') target = hi
    for (const i of indices) {
      es.vertices[i] = { ...es.vertices[i], [prop]: target }
    }
    editor.requestRepaint()
  }

  function nodeEditDeleteSelected() {
    const es = getNodeEditState()
    if (!es) return
    let live = getLiveNetwork(es)

    for (const key of es.selectedHandles) {
      const [siStr, tf] = key.split(':')
      const si = Number(siStr)
      const seg = live.segments[si]
      if (tf === 'tangentStart') seg.tangentStart = { x: 0, y: 0 }
      else seg.tangentEnd = { x: 0, y: 0 }
    }

    const verticesToDelete = [...es.selectedVertexIndices].sort((a, b) => b - a)
    for (const vi of verticesToDelete) {
      const next = deleteVertex(live, vi)
      if (!next) break
      live = next
    }

    setNodeEditNetwork(es, live)
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditBreakAtVertex() {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size === 0) return
    const [vertexIndex] = es.selectedVertexIndices
    const live = getLiveNetwork(es)
    const next = breakAtVertex(live, vertexIndex)
    setNodeEditNetwork(es, next)
    es.selectedHandles = new Set()
    es.selectedVertexIndices = new Set([vertexIndex])
    editor.requestRender()
  }

  // ─── File I/O ──────────────────────────────────────────────────

  function yieldToUI(): Promise<void> {
    return new Promise((r) => requestAnimationFrame(() => r()))
  }

  function setDocumentSource(
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) {
    stopWatchingFile()
    fileHandle = sourceFormat === 'fig' ? (handle ?? null) : null
    filePath = sourceFormat === 'fig' ? (path ?? null) : null
    downloadName = sourceFormat === 'fig' ? fileName : fileName.replace(/\.[^.]+$/i, '.fig')
    savedVersion = state.sceneVersion
    if (sourceFormat === 'fig' && (fileHandle || filePath)) {
      void startWatchingFile()
    }
  }

  function dispose() {
    stopWatchingFile()
    ;(debouncedAutosave as typeof debouncedAutosave & { cancel?: () => void }).cancel?.()
  }

  async function openFigFile(file: File, handle?: FileSystemFileHandle, path?: string) {
    try {
      state.loading = true
      await yieldToUI()
      const imported = await readFigFile(file)
      await yieldToUI()
      editor.replaceGraph(imported)
      editor.undo.clear()
      state.documentName = file.name.replace(/\.fig$/i, '')
      setDocumentSource(file.name, 'fig', handle, path)
      state.selectedIds = new Set()
      const firstPage = editor.graph.getPages()[0] as SceneNode | undefined
      const pageId = firstPage?.id ?? editor.graph.rootId
      await editor.switchPage(pageId)
      editor.requestRender()
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
    } else if (fileHandle) {
      const file = await fileHandle.getFile()
      const imported = await readFigFile(file)
      editor.replaceGraph(imported)
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
    format: RasterExportFormat
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

  function getExportBaseName(target: ExportRequest['target']): string {
    if (target.scope === 'node') {
      return editor.graph.getNode(target.nodeId)?.name ?? 'Export'
    }
    if (target.scope === 'selection' && target.nodeIds.length === 1) {
      return editor.graph.getNode(target.nodeIds[0])?.name ?? 'Export'
    }
    if (target.scope === 'page') {
      return editor.graph.getNode(target.pageId)?.name ?? 'Page'
    }
    return 'Export'
  }

  function getSelectionExportTarget(): ExportRequest['target'] {
    const ids = [...state.selectedIds]
    if (ids.length > 0) return { scope: 'selection', nodeIds: ids }
    return { scope: 'page', pageId: state.currentPageId }
  }

  function listSelectionExportFormats(): IOFormatAdapter[] {
    return io.listExportFormats(state.selectedIds.size > 0 ? 'selection' : 'page')
  }

  async function exportTarget(
    target: ExportRequest['target'],
    formatId: string,
    options?: { scale?: number; quality?: number; jsxFormat?: 'openpencil' | 'tailwind' }
  ) {
    const format = io.getFormat(formatId)
    if (!format) throw new Error(`Unknown export format: ${formatId}`)

    let exportOptions: unknown
    if (formatId === 'png' || formatId === 'jpg' || formatId === 'webp') {
      exportOptions = {
        format: formatId.toUpperCase(),
        scale: options?.scale ?? 1,
        quality: options?.quality
      }
    } else if (formatId === 'jsx') {
      exportOptions = { format: options?.jsxFormat ?? 'openpencil' }
    }

    const result = await io.exportContent(
      formatId,
      { graph: editor.graph, target },
      exportOptions,
      editor.renderer ? { canvasKit: editor.renderer.ck, renderer: editor.renderer } : undefined
    )

    const baseName = getExportBaseName(target)
    const fileName =
      formatId === 'png' || formatId === 'jpg' || formatId === 'webp'
        ? `${baseName}@${options?.scale ?? 1}x.${result.extension}`
        : `${baseName}.${result.extension}`

    const bytes =
      typeof result.data === 'string'
        ? new TextEncoder().encode(result.data)
        : new Uint8Array(result.data)

    await saveExportedFile(bytes, fileName, format.label, `.${result.extension}`, result.mimeType)
  }

  async function exportSelection(scale: number, formatId: 'png' | 'jpg' | 'webp' | 'svg' | 'fig') {
    await exportTarget(getSelectionExportTarget(), formatId, { scale })
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

  function viewportScreenCenter() {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  }

  function toggleProfiler() {
    editor.renderer?.profiler.toggle()
    editor.requestRepaint()
  }

  // ─── Public API ───────────────────────────────────────────────
  // Spread all core Editor methods, then override getters and add app-specific.

  const store = {
    ...editor,
    state,
    selectedNodes,
    selectedNode,
    layerTree,

    // App-specific overrides and additions
    flashNodes,
    aiMarkActive,
    aiMarkDone,
    aiFlashDone,
    aiClearAll,
    setTool,
    penResumeOnPath,
    penResumeFromEndpoint,
    enterNodeEditMode,
    exitNodeEditMode,
    nodeEditSelectVertex,
    nodeEditSetHandle,
    nodeEditBendHandle,
    nodeEditZeroVertexHandles,
    nodeEditConnectEndpoints,
    nodeEditAddVertex,
    nodeEditRemoveVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex,
    openFigFile,
    saveFigFile,
    saveFigFileAs,
    setDocumentSource,
    dispose,
    renderExportImage,
    listSelectionExportFormats,
    exportTarget,
    exportSelection,
    mobileCopy,
    mobileCut,
    mobilePaste,
    viewportScreenCenter,
    toggleProfiler
  }

  Object.defineProperties(store, {
    graph: {
      enumerable: true,
      get: () => editor.graph
    },
    renderer: {
      enumerable: true,
      get: () => editor.renderer
    },
    textEditor: {
      enumerable: true,
      get: () => editor.textEditor
    }
  })

  return store
}

export type EditorStore = ReturnType<typeof createEditorStore>

const storeRef = shallowRef<EditorStore>()

export function setActiveEditorStore(store: EditorStore) {
  storeRef.value = store
  triggerRef(storeRef)
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
