import { isPastPointerDragThreshold } from '#vue/shared/input/drag-threshold'
import type {
  DragEditHandle,
  DragEditMarquee,
  DragEditNode,
  DragState
} from '#vue/shared/input/types'
import {
  editVerticesInRect,
  getNodeEditState,
  hitTestEditHandle,
  hitTestEditRegion,
  hitTestEditSegment,
  hitTestEditVertex,
  isEndpoint,
  type NodeEditState
} from '#vue/shared/input/vector/hit-test'
import { applyNodeEditSnap } from '#vue/shared/input/vector/snap'

export {
  getNodeEditState,
  hitTestEditHandle,
  hitTestEditRegion,
  hitTestEditSegment,
  isEndpoint,
  NODE_HIT_THRESHOLD
} from '#vue/shared/input/vector/hit-test'
import type { Editor } from '@open-pencil/core/editor'
import { regionVertexIndices, vectorHandleId } from '@open-pencil/core/vector'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type NodeEditEditor = Partial<{
  nodeEditSelectVertex: (vertexIndex: number, addToSelection: boolean) => void
  exitNodeEditMode: (commit: boolean) => void
  nodeEditRemoveVertex: (vertexIndex: number) => void
  penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
  nodeEditAddVertex: (cx: number, cy: number) => void
  nodeEditPushHistory: () => void
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

export function handleNodeEditDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const es = getNodeEditState(editor)
  if (!es) return
  const nodeEditEditor = editor as Editor & NodeEditEditor

  // Anything but a shift-press on a region picks something else, so the picked regions go.
  if (!e.shiftKey) es.selectedRegions = new Set()

  const handleHit = hitTestEditHandle(editor, cx, cy)
  if (handleHit) {
    const key = vectorHandleId(handleHit.segmentIndex, handleHit.tangentField)

    if (e.shiftKey) {
      const next = new Set(es.selectedHandles)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      es.selectedHandles = next
    } else {
      es.selectedVertexIndices = new Set()
      es.selectedHandles = new Set([key])
    }
    nodeEditEditor.nodeEditPushHistory?.()
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

  // As in Figma, a press inside a region away from its points and segments picks the region:
  // its points are selected with it and drag with it.
  const ri = hitTestEditRegion(editor, cx, cy)
  if (ri !== null) {
    const points = pickRegion(es, ri, e.shiftKey)
    editor.requestRepaint()
    startPointsDrag(es, points, cx, cy, nodeEditEditor, setDrag)
    return
  }

  const vi = hitTestEditVertex(editor, cx, cy)
  if (vi !== null) {
    if (!e.shiftKey) es.selectedHandles = new Set()

    if (e.metaKey || e.ctrlKey) {
      nodeEditEditor.nodeEditSelectVertex?.(vi, false)
      nodeEditEditor.nodeEditPushHistory?.()
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

    if (!(es.selectedVertexIndices.has(vi) && !e.shiftKey)) {
      nodeEditEditor.nodeEditSelectVertex?.(vi, e.shiftKey)
    }

    startPointsDrag(es, [vi], cx, cy, nodeEditEditor, setDrag)
    return
  }

  // As in Figma, a press on a segment selects its two points and drags them with it.
  const si = hitTestEditSegment(editor, cx, cy)
  if (si !== null) {
    const points = pickSegment(es, si, e.shiftKey)
    editor.requestRepaint()
    startPointsDrag(es, points, cx, cy, nodeEditEditor, setDrag)
    return
  }

  // Empty space: a drag selects the points it encloses; a click leaves the path, on release.
  setDrag({
    type: 'edit-marquee',
    startX: cx,
    startY: cy,
    baseSelection: e.shiftKey ? new Set(es.selectedVertexIndices) : new Set()
  })
}

/**
 * Selects a segment's two points, adding them with Shift; a press on a segment whose points are
 * both selected keeps the selection, so the whole selection drags. Returns the two points.
 */
function pickSegment(es: NodeEditState, segmentIndex: number, add: boolean): number[] {
  const { start, end } = es.segments[segmentIndex]
  es.selectedHandles = new Set()
  if (add) es.selectedVertexIndices = new Set([...es.selectedVertexIndices, start, end])
  else if (!es.selectedVertexIndices.has(start) || !es.selectedVertexIndices.has(end))
    es.selectedVertexIndices = new Set([start, end])
  return [start, end]
}

/** Selects a region and its points, adding to the selection with Shift; returns its points. */
function pickRegion(es: NodeEditState, regionIndex: number, add: boolean): number[] {
  const network = { vertices: es.vertices, segments: es.segments, regions: es.regions }
  const points = regionVertexIndices(network, regionIndex)
  es.selectedHandles = new Set()
  if (add) {
    es.selectedRegions = new Set([...(es.selectedRegions ?? new Set<number>()), regionIndex])
    es.selectedVertexIndices = new Set([...es.selectedVertexIndices, ...points])
  } else {
    es.selectedRegions = new Set([regionIndex])
    es.selectedVertexIndices = new Set(points)
  }
  return points
}

/** Drags the selected points, and `pressed` with them, from where the pointer went down. */
function startPointsDrag(
  es: NodeEditState,
  pressed: number[],
  cx: number,
  cy: number,
  nodeEditEditor: NodeEditEditor,
  setDrag: (d: DragState) => void
) {
  const origPositions = new Map<number, Vector>()
  for (const index of [...es.selectedVertexIndices, ...pressed]) {
    origPositions.set(index, { x: es.vertices[index].x, y: es.vertices[index].y })
  }
  nodeEditEditor.nodeEditPushHistory?.()
  setDrag({ type: 'edit-node', startX: cx, startY: cy, origPositions })
}

/** Selects the points inside the marquee, with the ones it started with. */
export function handleNodeEditMarqueeMove(
  d: DragEditMarquee,
  cx: number,
  cy: number,
  editor: Editor
) {
  const es = getNodeEditState(editor)
  if (!es) return
  const marquee = {
    x: Math.min(d.startX, cx),
    y: Math.min(d.startY, cy),
    width: Math.abs(cx - d.startX),
    height: Math.abs(cy - d.startY)
  }
  es.selectedVertexIndices = new Set([...d.baseSelection, ...editVerticesInRect(editor, marquee)])
  es.selectedHandles = new Set()
  editor.setMarquee(marquee)
  editor.requestRepaint()
}

/** Ends a marquee over a path being edited; a click without a drag leaves the path. */
export function finishNodeEditMarquee(editor: Editor) {
  const marquee = editor.state.marquee
  const zoom = editor.state.zoom
  editor.setMarquee(null)
  const dragged =
    !!marquee && isPastPointerDragThreshold(0, 0, marquee.width * zoom, marquee.height * zoom)
  if (!dragged) (editor as Editor & NodeEditEditor).exitNodeEditMode?.(true)
}

export function handlePenNodeEditDown(e: MouseEvent, cx: number, cy: number, editor: Editor) {
  const es = getNodeEditState(editor)
  if (!es) return
  const nodeEditEditor = editor as Editor & NodeEditEditor

  const vi = hitTestEditVertex(editor, cx, cy)
  if (vi !== null) {
    if (e.altKey) {
      nodeEditEditor.nodeEditRemoveVertex?.(vi)
      return
    }
    if (isEndpoint(vi, es.segments)) {
      const nodeId = es.nodeId
      nodeEditEditor.exitNodeEditMode?.(true)
      nodeEditEditor.penResumeFromEndpoint?.(nodeId, vi)
    }
    return
  }

  nodeEditEditor.nodeEditAddVertex?.(cx, cy)
}

export function handleNodeEditMove(
  d: DragEditNode | DragEditHandle,
  cx: number,
  cy: number,
  editor: Editor,
  breakMirroring?: boolean,
  continuous?: boolean,
  lockDirection?: boolean,
  disableSnapping?: boolean
) {
  const nodeEditEditor = editor as Editor & NodeEditEditor
  if (d.type === 'edit-node') {
    const unsnappedDx = cx - d.startX
    const unsnappedDy = cy - d.startY
    const es = getNodeEditState(editor)
    if (!es) return
    let snapped = { x: unsnappedDx, y: unsnappedDy }
    if (disableSnapping) editor.setSnapGuides([])
    else snapped = applyNodeEditSnap(d, unsnappedDx, unsnappedDy, editor, es)

    for (const [idx, orig] of d.origPositions) {
      es.vertices[idx] = {
        ...es.vertices[idx],
        x: orig.x + snapped.x,
        y: orig.y + snapped.y
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
