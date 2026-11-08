import type {
  SceneNode,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { BLACK, PEN_CLOSE_MIN_POINTS } from '#core/constants'
import { createVectorFromNetwork, type CreateShape } from '#core/editor/shapes/vector'
import type { EditorContext, ResumedPath } from '#core/editor/types'
import { vectorChangesFromPagePath } from '#core/vector'

import { createPenHistory } from './history'

export interface PenDragOptions {
  keepOpposite?: boolean
  constrainToOpposite?: boolean
  oppositeTangent?: Vector | null
}

export type UpdateNodeWithUndo = (id: string, changes: Partial<SceneNode>, label?: string) => void

const PEN_DEFAULT_STROKE: SceneNode['strokes'][number] = {
  type: 'SOLID',
  color: BLACK,
  weight: 2,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

function projectTangentToAxis(active: Vector, opposite: Vector): Vector {
  const axis = { x: -opposite.x, y: -opposite.y }
  const axisLen = Math.hypot(axis.x, axis.y)
  if (axisLen <= 1e-6) return active
  const dir = { x: axis.x / axisLen, y: axis.y / axisLen }
  const len = Math.max(0, active.x * dir.x + active.y * dir.y)
  return { x: dir.x * len, y: dir.y * len }
}

/**
 * The network a continued path commits: the one it came from, with the pen's chain written back
 * over the part it walked and the new points and segments added, so branches the pen didn't walk
 * stay as they were. A closed chain becomes a new region.
 */
function continuedNetwork(
  resumed: ResumedPath,
  vertices: VectorVertex[],
  segments: VectorSegment[],
  closed: boolean
): VectorNetwork {
  const network = cloneVectorNetwork(resumed.network)
  const vertexIndex = vertices.map((vertex, i) => {
    const index = resumed.vertices.at(i)
    if (index === undefined) return network.vertices.push({ ...vertex }) - 1
    network.vertices[index] = { ...vertex }
    return index
  })
  const segmentIndex = segments.map((segment, i) => {
    const walked = resumed.segments.at(i)
    if (!walked) {
      return (
        network.segments.push({
          start: vertexIndex[segment.start],
          end: vertexIndex[segment.end],
          tangentStart: { ...segment.tangentStart },
          tangentEnd: { ...segment.tangentEnd }
        }) - 1
      )
    }
    const target = network.segments[walked.index]
    const [tangentStart, tangentEnd] = walked.reversed
      ? [segment.tangentEnd, segment.tangentStart]
      : [segment.tangentStart, segment.tangentEnd]
    target.tangentStart = { ...tangentStart }
    target.tangentEnd = { ...tangentEnd }
    return walked.index
  })
  if (closed) network.regions.push({ windingRule: 'NONZERO', loops: [segmentIndex] })
  return network
}

type PenState = NonNullable<EditorContext['state']['penState']>

/** Whether the pen is closing the path onto its first point, which takes two points or more. */
function closing(ps: PenState): boolean {
  return !!ps.pendingClose && ps.vertices.length >= PEN_CLOSE_MIN_POINTS
}

export function createPenActions(
  ctx: EditorContext,
  createShape: CreateShape,
  updateNodeWithUndo: UpdateNodeWithUndo
) {
  const history = createPenHistory(ctx)

  /**
   * Starts a press of the pen: what the press does until the next one is one undo step. Placing a
   * point starts one too, so a host needs this only for a press that places none, such as one
   * back on the last point or on the first to close the path.
   */
  function penPushHistory() {
    history.begin()
  }

  /**
   * Takes back the press in progress, the point it placed and its drag, leaving no undo step or
   * redo: a host that refuses the point, such as one off a shape being traced, puts it back so.
   */
  function penCancelPress() {
    history.cancel()
  }

  function penAddVertex(x: number, y: number) {
    history.begin()
    if (!ctx.state.penState) {
      ctx.state.penState = {
        vertices: [{ x, y }],
        segments: [],
        dragTangent: null,
        oppositeDragTangent: null,
        pendingClose: false,
        closingToFirst: false
      }
      ctx.requestRender()
      return
    }

    const ps = ctx.state.penState
    const prevIdx = ps.vertices.length - 1

    ps.vertices.push({ x, y })
    const newIdx = ps.vertices.length - 1
    ps.segments.push({
      start: prevIdx,
      end: newIdx,
      tangentStart: ps.dragTangent ?? { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
    ps.dragTangent = null
    ps.oppositeDragTangent = null
    ps.pendingClose = false
    ctx.requestRender()
  }

  function penSetDragTangent(tx: number, ty: number, options?: PenDragOptions) {
    const ps = ctx.state.penState
    if (!ps) return
    if (closing(ps)) {
      setClosingDrag(ps, { x: tx, y: ty }, options)
      ctx.requestRender()
      return
    }
    let active = { x: tx, y: ty }
    const anchor = ps.vertices[ps.vertices.length - 1]
    const lastSeg = ps.segments.at(-1)
    const opposite =
      options?.oppositeTangent ??
      ps.oppositeDragTangent ??
      (lastSeg ? lastSeg.tangentEnd : { x: -tx, y: -ty })

    if (options?.constrainToOpposite) {
      active = projectTangentToAxis(active, opposite)
    }

    ps.dragTangent = active
    const kept = options?.keepOpposite ? opposite : { x: -active.x, y: -active.y }
    ps.oppositeDragTangent = { x: kept.x, y: kept.y }
    if (lastSeg) lastSeg.tangentEnd = { x: kept.x, y: kept.y }
    if (!options?.keepOpposite) anchor.handleMirroring = 'ANGLE_AND_LENGTH'
    else anchor.handleMirroring = options.constrainToOpposite ? 'ANGLE' : 'NONE'
    ctx.requestRender()
  }

  /**
   * A drag on the closing press points the way the path carries on past its first point, as a drag
   * on any other point does: the closing segment arrives along its mirror, and the first segment
   * keeps the handle it left with (Figma). Held ⌘ keeps the two handles in line.
   */
  function setClosingDrag(ps: PenState, drag: Vector, options?: PenDragOptions) {
    const first = ps.vertices[0]
    const leaving = ps.segments.find((segment) => segment.start === 0)?.tangentStart
    let into = { x: -drag.x, y: -drag.y }
    if (options?.constrainToOpposite && leaving) into = projectTangentToAxis(into, leaving)
    ps.dragTangent = { x: -into.x, y: -into.y }
    ps.oppositeDragTangent = into
    first.handleMirroring = options?.constrainToOpposite ? 'ANGLE' : 'NONE'
  }

  function penSetClosingToFirst(closing: boolean) {
    if (!ctx.state.penState) return
    ctx.state.penState.closingToFirst = closing
    ctx.requestRender()
  }

  function penSetPendingClose(pending: boolean) {
    const ps = ctx.state.penState
    if (!ps) return
    // The drag at the first point takes `dragTangent`; the last point's handle waits aside.
    if (pending && !ps.pendingClose) {
      ps.closeTangent = ps.dragTangent
      ps.dragTangent = null
    } else if (!pending && ps.pendingClose) {
      ps.dragTangent = ps.closeTangent ?? null
      ps.closeTangent = null
    }
    ps.pendingClose = pending
    ctx.requestRepaint()
  }

  function penSetKnotPosition(x: number, y: number) {
    if (!ctx.state.penState) return
    const ps = ctx.state.penState
    const isClosing = closing(ps)
    const anchorIndex = isClosing ? 0 : ps.vertices.length - 1
    ps.vertices[anchorIndex].x = x
    ps.vertices[anchorIndex].y = y
    ctx.requestRender()
  }

  /** Ends the path, keeping what was drawn: one undo step, which undo draws on from again. */
  function penCommit(closed: boolean) {
    if (!ctx.state.penState) return
    history.end('Draw path', () => commitPath(closed))
  }

  function commitPath(closed: boolean) {
    const ps = ctx.state.penState
    if (!ps || ps.vertices.length < 2) {
      clearPath()
      return
    }

    if (closed && ps.vertices.length >= PEN_CLOSE_MIN_POINTS) {
      // A press on the first point holds the last handle aside and the drag there in
      // `dragTangent`; a close asked for without one leaves along the last handle, straight in.
      const pending = closing(ps)
      const out = pending ? ps.closeTangent : ps.dragTangent
      const drag = pending ? ps.dragTangent : null
      ps.segments.push({
        start: ps.vertices.length - 1,
        end: 0,
        tangentStart: out ? { ...out } : { x: 0, y: 0 },
        tangentEnd: drag ? { x: -drag.x, y: -drag.y } : { x: 0, y: 0 }
      })
    }

    const regions: VectorRegion[] = closed
      ? [{ windingRule: 'NONZERO', loops: [ps.segments.map((_, i) => i)] }]
      : []

    const resumed = ps.resumingNodeId ? ctx.graph.getNode(ps.resumingNodeId) : undefined
    const network: VectorNetwork = ps.resumedPath
      ? continuedNetwork(ps.resumedPath, ps.vertices, ps.segments, closed)
      : { vertices: ps.vertices, segments: ps.segments, regions }
    if (resumed?.type === 'VECTOR' && commitIntoLayer(resumed, network)) {
      finishPath()
      return
    }

    const fills = ps.resumedFills ? ps.resumedFills.map((f) => ({ ...f })) : []
    const strokes = ps.resumedStrokes
      ? ps.resumedStrokes.map((s) => ({ ...s }))
      : [{ ...PEN_DEFAULT_STROKE }]

    const nodeId = createVectorFromNetwork(
      ctx,
      createShape,
      { vertices: ps.vertices, segments: ps.segments, regions },
      { name: 'Vector', fills, strokes }
    )
    ctx.setSelectedIds(new Set([nodeId]))
    finishPath()
  }

  /**
   * Gives the layer a continued path came from its new points, as Figma does, rather than making
   * another layer: the layer keeps its name, place and style, and one undo puts its path back.
   */
  function commitIntoLayer(node: SceneNode, network: VectorNetwork): boolean {
    // The pen only adds points and segments to a continued path, so equal counts mean nothing
    // was drawn: the layer stays as it was, with no undo step.
    const before = node.vectorNetwork
    const unchanged =
      before &&
      before.vertices.length === network.vertices.length &&
      before.segments.length === network.segments.length &&
      before.regions.length === network.regions.length
    if (!unchanged) {
      const changes = vectorChangesFromPagePath(ctx.graph, node, network)
      if (!changes) return false
      updateNodeWithUndo(node.id, changes, 'Edit vector')
    }
    ctx.setSelectedIds(new Set([node.id]))
    return true
  }

  function clearPath() {
    ctx.state.penState = null
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    ctx.requestRender()
  }

  function finishPath() {
    clearPath()
    ctx.setActiveTool('SELECT')
  }

  /** Drops the path being drawn; undo brings it back. */
  function penCancel() {
    if (ctx.state.penState) history.end('Cancel path', finishPath)
    else finishPath()
  }

  return {
    penPushHistory,
    penCancelPress,
    penAddVertex,
    penSetDragTangent,
    penSetClosingToFirst,
    penSetPendingClose,
    penSetKnotPosition,
    penCommit,
    penCancel
  }
}
