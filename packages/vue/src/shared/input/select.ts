import {
  getAbsoluteRotation,
  SceneNode,
  Vector,
  VectorSegment,
  VectorVertex
} from '@open-pencil/core'

import {
  cornerRotationCursor,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix,
  buildResizeCursor
} from './geometry'
import { duplicateAndDrag, detectAutoLayoutParent } from './move'
import { tryStartResize } from './resize'

import type { DragEditHandle, DragEditNode, DragState } from './types'
import type { Editor } from '@open-pencil/core/editor'

type NodeEditState = {
  nodeId: string
  vertices: VectorVertex[]
  segments: VectorSegment[]
  selectedVertexIndices: Set<number>
  selectedHandles: Set<string>
  hoveredHandleInfo: {
    segmentIndex: number
    tangentField: 'tangentStart' | 'tangentEnd'
  } | null
}

type NodeEditEditor = Partial<{
  nodeEditSelectVertex: (vertexIndex: number, addToSelection: boolean) => void
  exitNodeEditMode: (commit: boolean) => void
  nodeEditRemoveVertex: (vertexIndex: number) => void
  penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
  nodeEditAddVertex: (cx: number, cy: number) => void
  nodeEditSetHandle: (
    segmentIndex: number,
    tangentField: 'tangentStart' | 'tangentEnd',
    newTangent: Vector,
    options?: {
      breakMirroring?: boolean
      continuous?: boolean
      lockDirection?: boolean
    }
  ) => void
}>

function getNodeEditState(editor: Editor): NodeEditState | null {
  return (
    (editor.state as Editor['state'] & { nodeEditState?: NodeEditState | null }).nodeEditState ??
    null
  )
}

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

export function resolveHit(
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns
): SceneNode | null {
  const titleHit =
    fns.hitTestFrameTitle(cx, cy) ??
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestComponentLabel(cx, cy)
  if (titleHit) return titleHit

  const hit = fns.hitTestInScope(cx, cy, false)
  if (hit) return hit

  const scopeId = editor.state.enteredContainerId
  if (!scopeId) return null

  if (fns.isInsideContainerBounds(cx, cy, scopeId)) {
    editor.clearSelection()
    return null
  }

  editor.exitContainer()
  const afterExit = fns.hitTestInScope(cx, cy, false)
  if (afterExit) return afterExit

  if (editor.state.enteredContainerId) {
    editor.exitContainer()
  }
  return null
}

// ---------------------------------------------------------------------------
// Node edit mode handlers
// ---------------------------------------------------------------------------

export const NODE_HIT_THRESHOLD = 8
const HANDLE_HIT_THRESHOLD_NE = 6

/** Check if vertex is an endpoint (connected to exactly 1 segment) */
export function isEndpoint(vertexIndex: number, segments: VectorSegment[]): boolean {
  let count = 0
  for (const seg of segments) {
    if (seg.start === vertexIndex || seg.end === vertexIndex) count++
  }
  return count === 1
}

function hitTestEditVertex(editor: Editor, cx: number, cy: number): number | null {
  const es = getNodeEditState(editor)
  if (!es) return null
  const iz = 1 / editor.state.zoom
  for (let i = 0; i < es.vertices.length; i++) {
    const v = es.vertices[i]
    if (Math.hypot(cx - v.x, cy - v.y) < NODE_HIT_THRESHOLD * iz) return i
  }
  return null
}

/** Vertices whose handles are visible: selected vertices + vertices with selected handles + their direct neighbors */
function getHandleVisibleVertices(editor: Editor): Set<number> {
  const es = getNodeEditState(editor)
  if (!es) return new Set()
  // Seed: selected vertices + vertices that own a selected handle
  const seed = new Set(es.selectedVertexIndices)
  for (const key of es.selectedHandles) {
    const [siStr, tf] = key.split(':')
    const seg = es.segments[Number(siStr)]
    seed.add(tf === 'tangentStart' ? seg.start : seg.end)
  }
  // Expand: add only direct neighbors of seed vertices (no cascading)
  const visible = new Set(seed)
  for (const seg of es.segments) {
    if (seed.has(seg.start)) visible.add(seg.end)
    if (seed.has(seg.end)) visible.add(seg.start)
  }
  return visible
}

export function hitTestEditHandle(
  editor: Editor,
  cx: number,
  cy: number
): {
  segmentIndex: number
  tangentField: 'tangentStart' | 'tangentEnd'
  vertexIndex: number
} | null {
  const es = getNodeEditState(editor)
  if (!es) return null
  const iz = 1 / editor.state.zoom
  const visible = getHandleVisibleVertices(editor)

  for (let si = 0; si < es.segments.length; si++) {
    const seg = es.segments[si]

    if (visible.has(seg.start)) {
      const ts = seg.tangentStart
      if (ts.x !== 0 || ts.y !== 0) {
        const hx = es.vertices[seg.start].x + ts.x
        const hy = es.vertices[seg.start].y + ts.y
        if (Math.hypot(cx - hx, cy - hy) < HANDLE_HIT_THRESHOLD_NE * iz) {
          return { segmentIndex: si, tangentField: 'tangentStart', vertexIndex: seg.start }
        }
      }
    }

    if (visible.has(seg.end)) {
      const te = seg.tangentEnd
      if (te.x !== 0 || te.y !== 0) {
        const hx = es.vertices[seg.end].x + te.x
        const hy = es.vertices[seg.end].y + te.y
        if (Math.hypot(cx - hx, cy - hy) < HANDLE_HIT_THRESHOLD_NE * iz) {
          return { segmentIndex: si, tangentField: 'tangentEnd', vertexIndex: seg.end }
        }
      }
    }
  }
  return null
}

function handleNodeEditDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const es = getNodeEditState(editor)
  if (!es) return
  const nodeEditEditor = editor as Editor & NodeEditEditor

  // Check handle hit first (only for vertices with visible handles)
  const handleHit = hitTestEditHandle(editor, cx, cy)
  if (handleHit) {
    const key = `${handleHit.segmentIndex}:${handleHit.tangentField}`
    if (e.shiftKey) {
      // Shift+click: toggle handle in multi-selection
      const next = new Set(es.selectedHandles)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      es.selectedHandles = next
    } else {
      // Click on handle: select only this handle, deselect everything else
      es.selectedVertexIndices = new Set()
      es.selectedHandles = new Set([key])
    }
    setDrag({
      type: 'edit-handle',
      segmentIndex: handleHit.segmentIndex,
      tangentField: handleHit.tangentField,
      vertexIndex: handleHit.vertexIndex,
      startX: cx,
      startY: cy,
      initialTangent: (() => {
        const seg = es.segments[handleHit.segmentIndex]
        const tangent =
          handleHit.tangentField === 'tangentStart' ? seg.tangentStart : seg.tangentEnd
        return { x: tangent.x, y: tangent.y }
      })()
    })
    return
  }

  // Check vertex hit
  const vi = hitTestEditVertex(editor, cx, cy)
  if (vi !== null) {
    if (!e.shiftKey) es.selectedHandles = new Set()

    // Cmd/Ctrl + vertex click → Bend mode (recreate handles from scratch)
    if (e.metaKey || e.ctrlKey) {
      nodeEditEditor.nodeEditSelectVertex?.(vi, false)
      setDrag({
        type: 'bend-handle',
        vertexIndex: vi,
        startX: es.vertices[vi].x,
        startY: es.vertices[vi].y,
        lockedMode: null,
        dragSamples: [],
        targetSegmentIndex: null,
        targetTangentField: null
      })
      return
    }

    // If vertex is already selected and not Shift — keep selection, just start drag
    if (es.selectedVertexIndices.has(vi) && !e.shiftKey) {
      // Don't re-select — preserve multi-selection for dragging
    } else {
      nodeEditEditor.nodeEditSelectVertex?.(vi, e.shiftKey)
    }

    // Start drag
    const origPositions = new Map<number, Vector>()
    for (const idx of es.selectedVertexIndices) {
      origPositions.set(idx, { x: es.vertices[idx].x, y: es.vertices[idx].y })
    }
    if (!origPositions.has(vi)) {
      origPositions.set(vi, { x: es.vertices[vi].x, y: es.vertices[vi].y })
    }

    setDrag({
      type: 'edit-node',
      startX: cx,
      startY: cy,
      origPositions
    })
    return
  }

  // Click on empty space: exit node edit mode
  nodeEditEditor.exitNodeEditMode?.(true)
}

export function handlePenNodeEditDown(e: MouseEvent, cx: number, cy: number, editor: Editor) {
  const es = getNodeEditState(editor)
  if (!es) return
  const nodeEditEditor = editor as Editor & NodeEditEditor

  const vi = hitTestEditVertex(editor, cx, cy)
  if (vi !== null) {
    // Alt+click on vertex → remove it (smooth merge of adjacent segments)
    if (e.altKey) {
      nodeEditEditor.nodeEditRemoveVertex?.(vi)
      return
    }
    // Click on endpoint → continue drawing from this endpoint
    if (isEndpoint(vi, es.segments)) {
      const nodeId = es.nodeId
      nodeEditEditor.exitNodeEditMode?.(true)
      nodeEditEditor.penResumeFromEndpoint?.(nodeId, vi)
      return
    }
    // Click on non-endpoint vertex → no action
    return
  }

  // Click on curve contour → add new anchor point
  nodeEditEditor.nodeEditAddVertex?.(cx, cy)
}

export function handleNodeEditMove(
  d: DragEditNode | DragEditHandle,
  cx: number,
  cy: number,
  editor: Editor,
  breakMirroring?: boolean,
  continuous?: boolean,
  lockDirection?: boolean
) {
  const nodeEditEditor = editor as Editor & NodeEditEditor
  if (d.type === 'edit-node') {
    const dx = cx - d.startX
    const dy = cy - d.startY
    const es = getNodeEditState(editor)
    if (!es) return

    for (const [idx, orig] of d.origPositions) {
      es.vertices[idx] = {
        ...es.vertices[idx],
        x: orig.x + dx,
        y: orig.y + dy
      }
    }
    editor.requestRepaint()
    return
  }
  const es = getNodeEditState(editor)
  if (!es) return
  const vertex = es.vertices[d.vertexIndex]
  let newTangent = { x: cx - vertex.x, y: cy - vertex.y }
  const canLockDirection =
    lockDirection &&
    (vertex.handleMirroring === 'ANGLE' || vertex.handleMirroring === 'ANGLE_AND_LENGTH')
  if (canLockDirection && d.initialTangent) {
    const len = Math.hypot(d.initialTangent.x, d.initialTangent.y)
    if (len > 1e-6) {
      const dir = { x: d.initialTangent.x / len, y: d.initialTangent.y / len }
      const projectedLen = Math.max(0, newTangent.x * dir.x + newTangent.y * dir.y)
      newTangent = { x: dir.x * projectedLen, y: dir.y * projectedLen }
    }
  }
  nodeEditEditor.nodeEditSetHandle?.(d.segmentIndex, d.tangentField, newTangent, {
    breakMirroring,
    continuous,
    lockDirection
  })
}

export function handleSelectDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  // Node edit mode intercept
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }

  if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

  if (editor.state.editingTextId) editor.commitTextEdit()

  if (tryStartRotation(cx, cy)) return

  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return
  }

  const hit = resolveHit(cx, cy, editor, fns)
  if (!hit) {
    if (!editor.state.enteredContainerId) {
      editor.clearSelection()
      setDrag({ type: 'marquee', startX: cx, startY: cy })
    }
    return
  }

  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  const allLocked = [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
  if (allLocked) return

  const originals = new Map<string, { x: number; y: number; parentId: string }>()
  for (const id of editor.state.selectedIds) {
    const n = editor.graph.getNode(id)
    if (n) originals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? editor.state.currentPageId })
  }

  if (e.altKey && editor.state.selectedIds.size > 0) {
    const result = duplicateAndDrag(cx, cy, editor)
    setDrag(result.drag)
    return
  }
  setDrag({
    type: 'move',
    startX: cx,
    startY: cy,
    currentX: cx,
    currentY: cy,
    originals,
    autoLayoutParentId: detectAutoLayoutParent(editor)
  })
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>
): string | null {
  if (getNodeEditState(editor)) {
    editor.setHoveredNode(null)
    return null
  }

  let cursor: string | null = null

  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue

    const handHit = getHitHandleByMatrix(cx, cy, node, editor.graph, editor?.renderer?.zoom!)
    if (handHit?.handle) {
      cursor = buildResizeCursor(handHit?.rotation)
      break
    }
  }

  if (!cursor && editor.state.selectedIds.size === 1) {
    const id = [...editor.state.selectedIds][0]
    const node = editor.graph.getNode(id)
    if (node) {
      const corner = hitTestCornerRotationByMatrix(
        cx,
        cy,
        node,
        editor.graph,
        editor?.renderer?.zoom!
      )
      if (corner) {
        const abRotation = getAbsoluteRotation(node, editor.graph)
        cursor = cornerRotationCursor(corner, abRotation)
      }
    }
  }

  const hit =
    fns.hitTestSectionTitle(cx, cy) ??
    fns.hitTestComponentLabel(cx, cy) ??
    fns.hitTestInScope(cx, cy, false)
  const editNodeId = getNodeEditState(editor)?.nodeId
  editor.setHoveredNode(
    hit && !editor.state.selectedIds.has(hit.id) && hit.id !== editNodeId ? hit.id : null
  )

  return cursor
}
