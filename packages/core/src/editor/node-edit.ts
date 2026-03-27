import {
  breakAtVertex,
  computeAccurateBounds,
  deleteVertex,
  findAllHandles,
  findOppositeHandle,
  mirrorHandle,
  nearestPointOnNetwork,
  removeVertex,
  splitSegmentAt
} from '../bezier-math'
import { cloneVectorNetwork } from '../scene-graph'

import type { VectorNetwork, VectorSegment, VectorVertex } from '../scene-graph'
import type { Vector } from '../types'
import type { EditorContext, HandleField, NodeEditState } from './types'

const NODE_EDIT_HIT_THRESHOLD = 8

type HandleInfo = {
  segmentIndex: number
  tangentField: HandleField
  neighborIndex: number
}

function getNodeEditState(ctx: EditorContext) {
  return ctx.state.nodeEditState
}

function setNodeEditNetwork(es: NodeEditState, network: VectorNetwork) {
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

function getLiveNetwork(es: NodeEditState): VectorNetwork {
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

function handleBaseVector(tangent: Vector, neighbor: Vector, origin: Vector): Vector {
  return Math.hypot(tangent.x, tangent.y) > 1e-6
    ? tangent
    : { x: neighbor.x - origin.x, y: neighbor.y - origin.y }
}

function findSisterHandle(
  es: NodeEditState,
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

function constrainContinuousTangent(
  es: NodeEditState,
  newTangent: Vector,
  active: HandleInfo,
  all: HandleInfo[],
  seg: VectorSegment,
  tangentField: HandleField,
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

export function createNodeEditActions(ctx: EditorContext) {
  function applyNodeEditToNode(es: NodeEditState) {
    const node = ctx.graph.getNode(es.nodeId)
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

    ctx.graph.updateNode(node.id, {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      vectorNetwork: relativeNetwork
    })
    ctx.requestRender()
  }

  function enterNodeEditMode(nodeId: string) {
    const node = ctx.graph.getNode(nodeId)
    if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

    const absVertices = node.vectorNetwork.vertices.map((v) => ({
      ...v,
      x: v.x + node.x,
      y: v.y + node.y
    }))

    ctx.state.nodeEditState = {
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

    ctx.state.selectedIds = new Set([nodeId])
    ctx.requestRender()
  }

  function exitNodeEditMode(commit: boolean) {
    const es = getNodeEditState(ctx)
    if (!es) return

    const node = ctx.graph.getNode(es.nodeId)
    if (node?.type !== 'VECTOR') {
      ctx.state.nodeEditState = null
      ctx.requestRender()
      return
    }

    if (commit) {
      applyNodeEditToNode(es)
    } else {
      ctx.graph.updateNode(es.nodeId, {
        x: es.origBounds.x,
        y: es.origBounds.y,
        width: es.origBounds.width,
        height: es.origBounds.height,
        vectorNetwork: cloneVectorNetwork(es.origNetwork)
      })
      ctx.requestRender()
    }

    ctx.state.nodeEditState = null
  }

  function nodeEditSelectVertex(vertexIndex: number, addToSelection: boolean) {
    const es = getNodeEditState(ctx)
    if (!es) return
    if (addToSelection) {
      const next = new Set(es.selectedVertexIndices)
      if (next.has(vertexIndex)) next.delete(vertexIndex)
      else next.add(vertexIndex)
      es.selectedVertexIndices = next
    } else {
      es.selectedVertexIndices = new Set([vertexIndex])
    }
    ctx.requestRepaint()
  }

  function nodeEditSetHandle(
    segmentIndex: number,
    tangentField: HandleField,
    newTangent: Vector,
    options?: {
      breakMirroring?: boolean
      continuous?: boolean
      lockDirection?: boolean
    }
  ) {
    const es = getNodeEditState(ctx)
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
      ctx.requestRepaint()
      return
    }
    if (breakMirroring) {
      vertex.handleMirroring = 'NONE'
      ctx.requestRepaint()
      return
    }
    if (mode === 'NONE') {
      ctx.requestRepaint()
      return
    }

    const opposite = findOppositeHandle(live, vertexIndex, segmentIndex)
    if (!opposite) {
      ctx.requestRepaint()
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
    ctx.requestRepaint()
  }

  function nodeEditBendHandle(
    vertexIndex: number,
    dx: number,
    dy: number,
    independent: boolean,
    targetSegmentIndex: number | null,
    targetTangentField: HandleField | null
  ) {
    const es = getNodeEditState(ctx)
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
    ctx.requestRepaint()
  }

  function nodeEditZeroVertexHandles(vertexIndex: number) {
    const es = getNodeEditState(ctx)
    if (!es) return
    const live = getLiveNetwork(es)
    const handles = findAllHandles(live, vertexIndex)
    for (const h of handles) {
      es.segments[h.segmentIndex][h.tangentField] = { x: 0, y: 0 }
    }
    es.vertices[vertexIndex].handleMirroring = 'NONE'
    ctx.requestRepaint()
  }

  function nodeEditConnectEndpoints(a: number, b: number) {
    const es = getNodeEditState(ctx)
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
    ctx.requestRender()
  }

  function nodeEditAddVertex(cx: number, cy: number) {
    const es = getNodeEditState(ctx)
    if (!es) return
    const live = getLiveNetwork(es)
    const nearest = nearestPointOnNetwork(cx, cy, live, NODE_EDIT_HIT_THRESHOLD / ctx.state.zoom)
    if (!nearest) return
    const split = splitSegmentAt(live, nearest.segmentIndex, nearest.t)
    setNodeEditNetwork(es, split.network)
    es.selectedVertexIndices = new Set([split.newVertexIndex])
    es.selectedHandles = new Set()
    ctx.requestRender()
  }

  function nodeEditRemoveVertex(vertexIndex: number) {
    const es = getNodeEditState(ctx)
    if (!es) return
    const live = getLiveNetwork(es)
    const next = removeVertex(live, vertexIndex)
    if (!next) return
    setNodeEditNetwork(es, next)
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    ctx.requestRender()
  }

  function nodeEditAlignVertices(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max') {
    const es = getNodeEditState(ctx)
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

    const target = align === 'min' ? lo : (align === 'max' ? hi : (lo + hi) / 2)
    for (const i of indices) {
      es.vertices[i] = { ...es.vertices[i], [prop]: target }
    }
    ctx.requestRepaint()
  }

  function nodeEditDeleteSelected() {
    const es = getNodeEditState(ctx)
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
    ctx.requestRender()
  }

  function nodeEditBreakAtVertex() {
    const es = getNodeEditState(ctx)
    if (!es || es.selectedVertexIndices.size === 0) return
    const [vertexIndex] = es.selectedVertexIndices
    const live = getLiveNetwork(es)
    const next = breakAtVertex(live, vertexIndex)
    setNodeEditNetwork(es, next)
    es.selectedHandles = new Set()
    es.selectedVertexIndices = new Set([vertexIndex])
    ctx.requestRender()
  }

  return {
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
    nodeEditBreakAtVertex
  }
}
