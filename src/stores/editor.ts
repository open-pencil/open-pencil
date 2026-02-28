import { reactive, shallowRef, computed } from 'vue'

import { DEFAULT_SHAPE_FILL, DEFAULT_FRAME_FILL, CANVAS_BG_COLOR, ZOOM_SENSITIVITY } from '../constants'
import type { Color } from '../types'
import {
  parseFigmaClipboard,
  importClipboardNodes,
  parseOpenPencilClipboard,
  buildFigmaClipboardHTML,
  buildOpenPencilClipboardHTML,
  prefetchFigmaSchema
} from '../engine/clipboard'
import { readFigFile } from '../kiwi/fig-file'
import { computeLayout, computeAllLayouts } from '../engine/layout'
import { SceneGraph } from '../engine/scene-graph'
import { UndoManager } from '../engine/undo'
import { computeVectorBounds } from '../engine/vector'

import type { SceneNode, NodeType, Fill, LayoutMode, VectorVertex, VectorSegment, VectorRegion, VectorNetwork } from '../engine/scene-graph'
import type { SnapGuide } from '../engine/snap'

export type Tool = 'SELECT' | 'FRAME' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'TEXT' | 'PEN' | 'HAND'

export interface ToolDef {
  key: Tool
  label: string
  shortcut: string
  flyout?: Tool[]
}

export const TOOLS: ToolDef[] = [
  { key: 'SELECT', label: 'Move', shortcut: 'V' },
  { key: 'FRAME', label: 'Frame', shortcut: 'F' },
  { key: 'RECTANGLE', label: 'Rectangle', shortcut: 'R', flyout: ['RECTANGLE', 'ELLIPSE', 'LINE'] },
  { key: 'PEN', label: 'Pen', shortcut: 'P' },
  { key: 'TEXT', label: 'Text', shortcut: 'T' },
  { key: 'HAND', label: 'Hand', shortcut: 'H' }
]

export const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'SELECT',
  f: 'FRAME',
  r: 'RECTANGLE',
  o: 'ELLIPSE',
  l: 'LINE',
  t: 'TEXT',
  p: 'PEN',
  h: 'HAND'
}

const BLACK_FILL: Fill = { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

const DEFAULT_FILLS: Record<string, Fill> = {
  FRAME: DEFAULT_FRAME_FILL,
  RECTANGLE: DEFAULT_SHAPE_FILL,
  ELLIPSE: DEFAULT_SHAPE_FILL,
  LINE: BLACK_FILL,
  TEXT: BLACK_FILL
}

export function createEditorStore() {
  let graph = new SceneGraph()
  const undo = new UndoManager()

  prefetchFigmaSchema()

  const state = reactive({
    activeTool: 'SELECT' as Tool,
    selectedIds: new Set<string>(),
    marquee: null as { x: number; y: number; width: number; height: number } | null,
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
    editingTextId: null as string | null,
    penState: null as {
      vertices: VectorVertex[]
      segments: VectorSegment[]
      dragTangent: { x: number; y: number } | null
      closingToFirst: boolean
    } | null,
    penCursorX: null as number | null,
    penCursorY: null as number | null,
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR } as Color,
    panY: 0,
    zoom: 1,
    renderVersion: 0
  })

  const selectedNodes = computed(() => {
    void state.renderVersion
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
    void state.renderVersion
    return graph.flattenTree()
  })

  function requestRender() {
    state.renderVersion++
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

  function setMarquee(rect: { x: number; y: number; width: number; height: number } | null) {
    state.marquee = rect
    requestRender()
  }

  function setSnapGuides(guides: SnapGuide[]) {
    state.snapGuides = guides
    requestRender()
  }

  function setRotationPreview(preview: { nodeId: string; angle: number } | null) {
    state.rotationPreview = preview
    requestRender()
  }

  function setDropTarget(id: string | null) {
    state.dropTargetId = id
    requestRender()
  }

  function setLayoutInsertIndicator(
    indicator: typeof state.layoutInsertIndicator
  ) {
    state.layoutInsertIndicator = indicator
    requestRender()
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
    for (const id of nodeIds) {
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
      fills: closed
        ? [{ ...DEFAULT_SHAPE_FILL }]
        : [],
      strokes: closed
        ? []
        : [{ color: { r: 0, g: 0, b: 0, a: 1 }, weight: 2, opacity: 1, visible: true, align: 'CENTER' as const }]
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
    state.editingTextId = nodeId
  }

  function commitTextEdit(nodeId: string, text: string) {
    const node = graph.getNode(nodeId)
    const prevText = node?.text ?? ''
    graph.updateNode(nodeId, { text })
    state.editingTextId = null
    undo.push({
      label: 'Edit text',
      forward: () => {
        graph.updateNode(nodeId, { text })
        requestRender()
      },
      inverse: () => {
        graph.updateNode(nodeId, { text: prevText })
        requestRender()
      }
    })
    requestRender()
  }

  async function openFigFile(file: File) {
    try {
      const imported = await readFigFile(file)
      graph = imported
      computeAllLayouts(graph)
      undo.clear()
      state.selectedIds = new Set()
      state.panX = 0
      state.panY = 0
      state.zoom = 1
      requestRender()
    } catch (e) {
      console.error('Failed to open .fig file:', e)
    }
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
    runLayoutForNode(id)
    requestRender()
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
    undo.push({
      label,
      forward: () => {
        graph.updateNode(id, changes)
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
    const updated = graph.getNode(id)!
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

    const parentId = nodes[0].parentId ?? graph.rootId
    const sameParent = nodes.every((n) => (n.parentId ?? graph.rootId) === parentId)
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

    const parentAbs =
      parentId === graph.rootId ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)

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

    const parentId = nodes[0].parentId ?? graph.rootId
    const sameParent = nodes.every((n) => (n.parentId ?? graph.rootId) === parentId)
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

    const parentAbs =
      parentId === graph.rootId ? { x: 0, y: 0 } : graph.getAbsolutePosition(parentId)

    // Insert group at the position of the topmost selected node
    const firstIndex = Math.min(...nodeIds.map((id) => parent.childIds.indexOf(id)))

    const group = graph.createNode('GROUP', parentId, {
      name: 'Group',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width: maxX - minX,
      height: maxY - minY,
      fills: [],
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

  function ungroupSelected() {
    const node = selectedNode.value
    if (!node || node.type !== 'GROUP') return

    const parentId = node.parentId ?? graph.rootId
    const parent = graph.getNode(parentId)
    if (!parent) return

    const groupIndex = parent.childIds.indexOf(node.id)
    const childIds = [...node.childIds]
    const prevSelection = new Set(state.selectedIds)
    const origPositions = childIds.map((id) => {
      const child = graph.getNode(id)!
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

  function createShape(
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string
  ): string {
    const fill = DEFAULT_FILLS[type] ?? DEFAULT_FILLS.RECTANGLE
    const pid = parentId ?? graph.rootId
    const node = graph.createNode(type, pid, {
      x,
      y,
      width: w,
      height: h,
      fills: [{ ...fill }]
    })
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
        state.selectedIds.delete(id)
        requestRender()
      }
    })
    requestRender()
    return id
  }

  function selectAll() {
    const children = graph.getChildren(graph.rootId)
    state.selectedIds = new Set(children.map((n) => n.id))
  }

  function duplicateSelected() {
    const prevSelection = new Set(state.selectedIds)
    const newIds: string[] = []
    const snapshots: Array<{ id: string; parentId: string; snapshot: SceneNode }> = []

    for (const id of state.selectedIds) {
      const src = graph.getNode(id)
      if (!src) continue
      const parentId = src.parentId ?? graph.rootId
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
    const internalHtml = buildOpenPencilClipboardHTML(nodes, graph)
    const figmaHtml = buildFigmaClipboardHTML(nodes, graph)

    const html = figmaHtml ? figmaHtml + internalHtml : internalHtml
    clipboardData.setData('text/html', html)
    clipboardData.setData('text/plain', names)
  }

  function pasteFromHTML(html: string) {
    const ownNodes = parseOpenPencilClipboard(html)
    if (ownNodes) {
      pasteOpenPencilNodes(ownNodes)
      return
    }

    parseFigmaClipboard(html).then((figma) => {
      if (figma) {
        const created = importClipboardNodes(figma.nodes, graph, graph.rootId, 20, 20, figma.blobs)
        if (created.length > 0) {
          state.selectedIds = new Set(created)
          requestRender()
        }
      }
    })
  }

  function pasteOpenPencilNodes(
    nodes: Array<SceneNode & { children?: SceneNode[] }>,
    parentId?: string
  ) {
    const target = parentId ?? graph.rootId
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
      const parentId = node.parentId ?? graph.rootId
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
    undo.push({
      label: 'Move',
      forward: () => {
        for (const [id, pos] of finals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
        requestRender()
      },
      inverse: () => {
        for (const [id, pos] of originals) {
          graph.updateNode(id, pos)
          runLayoutForNode(id)
        }
        requestRender()
      }
    })
  }

  function commitResize(
    nodeId: string,
    origRect: { x: number; y: number; width: number; height: number }
  ) {
    const node = graph.getNode(nodeId)
    if (!node) return
    const finalRect = { x: node.x, y: node.y, width: node.width, height: node.height }
    undo.push({
      label: 'Resize',
      forward: () => {
        graph.updateNode(nodeId, finalRect)
        runLayoutForNode(nodeId)
        requestRender()
      },
      inverse: () => {
        graph.updateNode(nodeId, origRect)
        runLayoutForNode(nodeId)
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
    requestRender()
  }

  function pan(dx: number, dy: number) {
    state.panX += dx
    state.panY += dy
    requestRender()
  }

  function zoomToFit() {
    const nodes = graph.getChildren(graph.rootId)
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
    requestRender()
  }

  return {
    get graph() {
      return graph
    },
    undo,
    state,
    selectedNodes,
    selectedNode,
    layerTree,
    requestRender,
    setTool,
    select,
    clearSelection,
    selectAll,
    setMarquee,
    setSnapGuides,
    setRotationPreview,
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
    updateNode,
    setLayoutMode,
    wrapInAutoLayout,
    groupSelected,
    ungroupSelected,
    createShape,
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
    zoomToFit
  }
}

export type EditorStore = ReturnType<typeof createEditorStore>

const storeRef = shallowRef<EditorStore>()

export function provideEditorStore(): EditorStore {
  const store = createEditorStore()
  storeRef.value = store
  return store
}

export function useEditorStore(): EditorStore {
  if (!storeRef.value) throw new Error('Editor store not provided')
  return storeRef.value
}
