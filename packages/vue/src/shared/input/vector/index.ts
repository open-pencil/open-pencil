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
import type { Editor } from '@open-pencil/core'
import { regionVertexIndices, vectorHandleId } from '@open-pencil/core/vector'
import type { Vector } from '@open-pencil/scene-graph/primitives'

type NodeEditEditor = Partial<{
  nodeEditSelectVertex: (vertexIndex: number, addToSelection: boolean) => void
  exitNodeEditMode: (commit: boolean) => void
  nodeEditRemoveVertex: (vertexIndex: number) => void
  penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
  penStartPiece: (nodeId: string, point: Vector) => void
  nodeEditAddVertex: (cx: number, cy: number) => boolean
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

  const handleHit = hitTestEditHandle(editor, cx, cy)
  const ri = handleHit ? null : hitTestEditRegion(editor, cx, cy)
  if (!e.shiftKey && !pressesPickedRegion(es, ri)) es.selectedRegions = new Set()

  if (handleHit) {
    pressHandle(es, handleHit, e.shiftKey, cx, cy, nodeEditEditor, setDrag)
    return
  }

  // As in Figma, a press inside a region away from its points and segments picks the region:
  // its points are selected with it and drag with it. A press on a picked region keeps the
  // selection so all of it drags, as with segments.
  if (ri !== null) {
    const click = pickRegion(es, ri, e.shiftKey)
    editor.requestRepaint()
    startPointsDrag(es, regionPoints(es, ri), cx, cy, nodeEditEditor, setDrag, click)
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

  // As in Figma, a press on a segment selects the segment itself, not its endpoints, and drags
  // its two points with the rest of the selection. A press on a selected segment keeps the
  // selection so all of it drags; the click acts only on a release without a drag.
  const si = hitTestEditSegment(editor, cx, cy)
  if (si !== null) {
    const click = selectPressedSegment(es, si, e.shiftKey)
    editor.requestRepaint()
    const { start, end } = es.segments[si]
    startPointsDrag(es, [start, end], cx, cy, nodeEditEditor, setDrag, click)
    return
  }

  // Empty space: a drag selects what it encloses; a click leaves the path, on release.
  setDrag({
    type: 'edit-marquee',
    startX: cx,
    startY: cy,
    baseSelection: e.shiftKey ? new Set(es.selectedVertexIndices) : new Set(),
    baseSegments: e.shiftKey ? new Set(es.selectedSegmentIndices) : new Set()
  })
}

/**
 * Whether a press lands on a region already picked, which keeps the picked regions; any other
 * press without Shift picks something else, so they go.
 */
function pressesPickedRegion(es: NodeEditState, region: number | null) {
  return region !== null && Boolean(es.selectedRegions?.has(region))
}

/** Selects a pressed tangent handle, toggling it with Shift, and starts dragging it. */
function pressHandle(
  es: NodeEditState,
  handleHit: NonNullable<ReturnType<typeof hitTestEditHandle>>,
  shift: boolean,
  cx: number,
  cy: number,
  nodeEditEditor: NodeEditEditor,
  setDrag: (d: DragState) => void
) {
  const key = vectorHandleId(handleHit.segmentIndex, handleHit.tangentField)

  if (shift) {
    const next = new Set(es.selectedHandles)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    es.selectedHandles = next
  } else {
    es.selectedVertexIndices = new Set()
    es.selectedSegmentIndices = new Set()
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
      const tangent = handleHit.tangentField === 'tangentStart' ? seg.tangentStart : seg.tangentEnd
      return { x: tangent.x, y: tangent.y }
    })()
  })
}

/**
 * Selects a pressed segment: Shift adds it, otherwise it becomes the selection. A segment already
 * selected stays as it is, so all of the selection drags; the result is what a release without a
 * drag does to it then.
 */
function selectPressedSegment(
  es: NodeEditState,
  segmentIndex: number,
  shift: boolean
): DragEditNode['click'] {
  es.selectedHandles = new Set()
  if (es.selectedSegmentIndices.has(segmentIndex)) {
    return { part: 'segment', index: segmentIndex, deselect: shift }
  }
  if (!shift) es.selectedVertexIndices = new Set()
  es.selectedSegmentIndices = shift
    ? new Set([...es.selectedSegmentIndices, segmentIndex])
    : new Set([segmentIndex])
  return undefined
}

function regionPoints(es: NodeEditState, regionIndex: number): number[] {
  return regionVertexIndices(
    { vertices: es.vertices, segments: es.segments, regions: es.regions },
    regionIndex
  )
}

/**
 * Picks a pressed region and its points: Shift adds them, otherwise they become the selection. A
 * region already picked stays as it is, so all of the selection drags; the result is what a
 * release without a drag does to it then.
 */
function pickRegion(es: NodeEditState, regionIndex: number, add: boolean): DragEditNode['click'] {
  es.selectedHandles = new Set()
  if (es.selectedRegions?.has(regionIndex)) {
    return { part: 'region', index: regionIndex, deselect: add }
  }
  const points = regionPoints(es, regionIndex)
  if (add) {
    es.selectedRegions = new Set([...(es.selectedRegions ?? new Set<number>()), regionIndex])
    es.selectedVertexIndices = new Set([...es.selectedVertexIndices, ...points])
  } else {
    es.selectedRegions = new Set([regionIndex])
    es.selectedVertexIndices = new Set(points)
    es.selectedSegmentIndices = new Set()
  }
  return undefined
}

/**
 * Drags the selected points and segments, and `pressed` with them, from where the pointer went
 * down. `click` is what a release without a drag does to the selected part that was pressed.
 */
function startPointsDrag(
  es: NodeEditState,
  pressed: number[],
  cx: number,
  cy: number,
  nodeEditEditor: NodeEditEditor,
  setDrag: (d: DragState) => void,
  click?: DragEditNode['click']
) {
  const segmentEnds = [...es.selectedSegmentIndices].flatMap((index) => {
    const segment = es.segments.at(index)
    return segment ? [segment.start, segment.end] : []
  })
  const origPositions = new Map<number, Vector>()
  for (const index of [...es.selectedVertexIndices, ...segmentEnds, ...pressed]) {
    origPositions.set(index, { x: es.vertices[index].x, y: es.vertices[index].y })
  }
  nodeEditEditor.nodeEditPushHistory?.()
  setDrag({ type: 'edit-node', startX: cx, startY: cy, origPositions, click })
}

/**
 * A press on a selected segment or region that ends without moving anything: as in Figma, a click
 * selects only that part and a Shift-click takes it out of the selection.
 */
export function finishPartClick(d: DragEditNode, editor: Editor) {
  const es = getNodeEditState(editor)
  if (!es || !d.click) return
  const moved = [...d.origPositions].some(([index, orig]) => {
    const vertex = es.vertices.at(index)
    return vertex !== undefined && (vertex.x !== orig.x || vertex.y !== orig.y)
  })
  if (moved) return
  if (d.click.part === 'segment') clickSegment(es, d.click.index, d.click.deselect)
  else clickRegion(es, d.click.index, d.click.deselect)
  editor.requestRepaint()
}

function clickSegment(es: NodeEditState, segment: number, deselect: boolean) {
  if (deselect) {
    const next = new Set(es.selectedSegmentIndices)
    next.delete(segment)
    es.selectedSegmentIndices = next
  } else {
    es.selectedVertexIndices = new Set()
    es.selectedSegmentIndices = new Set([segment])
  }
}

/** A deselected region takes its points with it, except those another picked region shares. */
function clickRegion(es: NodeEditState, region: number, deselect: boolean) {
  if (!deselect) {
    es.selectedRegions = new Set([region])
    es.selectedVertexIndices = new Set(regionPoints(es, region))
    es.selectedSegmentIndices = new Set()
    return
  }
  const rest = [...(es.selectedRegions ?? [])].filter((index) => index !== region)
  const kept = new Set(rest.flatMap((index) => regionPoints(es, index)))
  const dropped = new Set(regionPoints(es, region).filter((index) => !kept.has(index)))
  es.selectedRegions = new Set(rest)
  es.selectedVertexIndices = new Set(
    [...es.selectedVertexIndices].filter((index) => !dropped.has(index))
  )
}

/** Selects the points inside the marquee and the segments between them, with what it started with. */
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
  const enclosed = new Set(editVerticesInRect(editor, marquee))
  const enclosedSegments = es.segments.flatMap((segment, index) =>
    enclosed.has(segment.start) && enclosed.has(segment.end) ? [index] : []
  )
  es.selectedVertexIndices = new Set([...d.baseSelection, ...enclosed])
  es.selectedSegmentIndices = new Set([...d.baseSegments, ...enclosedSegments])
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

/**
 * A pen press on the path being edited: an end point continues the path from there, a segment gets
 * a point, and anywhere else starts a new piece of the same path at `pieceStart`, as in Figma.
 */
export function handlePenNodeEditDown(
  e: Pick<MouseEvent, 'altKey'>,
  cx: number,
  cy: number,
  editor: Editor,
  pieceStart: Vector = { x: cx, y: cy }
) {
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

  if (nodeEditEditor.nodeEditAddVertex?.(cx, cy)) return
  const nodeId = es.nodeId
  nodeEditEditor.exitNodeEditMode?.(true)
  nodeEditEditor.penStartPiece?.(nodeId, pieceStart)
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
