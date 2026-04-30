import type { HandleInfo, NodeEditState } from './types'
import type { VectorSegment, VectorVertex } from '@open-pencil/core/scene-graph'
import type { Vector } from '@open-pencil/core/types'

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

export function constrainContinuousTangent(
  es: NodeEditState,
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
