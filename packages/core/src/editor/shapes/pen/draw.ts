import type {
  SceneNode,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import { cloneVectorNetwork } from '@open-pencil/scene-graph/copy'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { BLACK } from '#core/constants'
import { createVectorFromNetwork, type CreateShape } from '#core/editor/shapes/vector'
import type { EditorContext, ResumedPath } from '#core/editor/types'
import { vectorChangesFromPagePath } from '#core/vector'

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

function applyAnchorTangent(
  tangent: Vector,
  isClosing: boolean,
  firstSeg: VectorSegment | undefined,
  lastSeg: VectorSegment | undefined
): void {
  if (isClosing) {
    if (!firstSeg) return
    if (firstSeg.start === 0) firstSeg.tangentStart = { x: tangent.x, y: tangent.y }
    else if (firstSeg.end === 0) firstSeg.tangentEnd = { x: tangent.x, y: tangent.y }
    return
  }
  if (lastSeg) {
    lastSeg.tangentEnd = { x: tangent.x, y: tangent.y }
  }
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

export function createPenActions(
  ctx: EditorContext,
  createShape: CreateShape,
  updateNodeWithUndo: UpdateNodeWithUndo
) {
  function penAddVertex(x: number, y: number) {
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
    if (!ctx.state.penState) return
    const ps = ctx.state.penState
    let active = { x: tx, y: ty }
    const isClosing = !!ps.pendingClose && ps.vertices.length > 2
    const anchorIndex = isClosing ? 0 : ps.vertices.length - 1
    const lastSeg = ps.segments.length > 0 ? ps.segments[ps.segments.length - 1] : undefined
    const firstSeg = ps.segments.length > 0 ? ps.segments[0] : undefined
    const opposite =
      options?.oppositeTangent ??
      ps.oppositeDragTangent ??
      (lastSeg ? lastSeg.tangentEnd : { x: -tx, y: -ty })

    if (options?.constrainToOpposite) {
      active = projectTangentToAxis(active, opposite)
    }

    ps.dragTangent = active
    const keepOpposite = options?.keepOpposite ?? isClosing
    if (keepOpposite) {
      ps.oppositeDragTangent = { x: opposite.x, y: opposite.y }
      applyAnchorTangent(opposite, isClosing, firstSeg, lastSeg)
      if (options?.constrainToOpposite) {
        ps.vertices[anchorIndex].handleMirroring = 'ANGLE'
      } else {
        ps.vertices[anchorIndex].handleMirroring = 'NONE'
      }
    } else {
      const symmetric = { x: -active.x, y: -active.y }
      ps.oppositeDragTangent = symmetric
      applyAnchorTangent(symmetric, isClosing, firstSeg, lastSeg)
      ps.vertices[anchorIndex].handleMirroring = 'ANGLE_AND_LENGTH'
    }
    ctx.requestRender()
  }

  function penSetClosingToFirst(closing: boolean) {
    if (!ctx.state.penState) return
    ctx.state.penState.closingToFirst = closing
    ctx.requestRender()
  }

  function penSetPendingClose(closing: boolean) {
    if (!ctx.state.penState) return
    ctx.state.penState.pendingClose = closing
    ctx.requestRepaint()
  }

  function penSetKnotPosition(x: number, y: number) {
    if (!ctx.state.penState) return
    const ps = ctx.state.penState
    const isClosing = !!ps.pendingClose && ps.vertices.length > 2
    const anchorIndex = isClosing ? 0 : ps.vertices.length - 1
    ps.vertices[anchorIndex].x = x
    ps.vertices[anchorIndex].y = y
    ctx.requestRender()
  }

  function penCommit(closed: boolean) {
    const ps = ctx.state.penState
    if (!ps || ps.vertices.length < 2) {
      ctx.state.penState = null
      ctx.state.penCursorX = null
      ctx.state.penCursorY = null
      return
    }

    if (closed && ps.pendingClose && ps.vertices.length > 2) {
      const prevIdx = ps.vertices.length - 1
      ps.segments.push({
        start: prevIdx,
        end: 0,
        tangentStart: { x: 0, y: 0 },
        tangentEnd: ps.dragTangent ?? { x: 0, y: 0 }
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

  function finishPath() {
    ctx.state.penState = null
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    ctx.setActiveTool('SELECT')
    ctx.requestRender()
  }

  function penCancel() {
    ctx.state.penState = null
    ctx.state.penCursorX = null
    ctx.state.penCursorY = null
    ctx.setActiveTool('SELECT')
    ctx.requestRender()
  }

  return {
    penAddVertex,
    penSetDragTangent,
    penSetClosingToFirst,
    penSetPendingClose,
    penSetKnotPosition,
    penCommit,
    penCancel
  }
}
