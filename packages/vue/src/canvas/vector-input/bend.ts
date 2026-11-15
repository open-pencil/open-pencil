import type { Editor, NodeEditState } from '@open-pencil/core'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { DragState } from '#vue/shared/input/types'

/** What picking a bend's handle reads from the edit session. */
export type CanvasNodeEditState = Pick<NodeEditState, 'segments' | 'vertices'>

export function resolveBendTargetHandle(
  es: CanvasNodeEditState | null,
  vertexIndex: number,
  samples: Vector[]
): { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null {
  if (!es || samples.length === 0) return null
  const vertex = es.vertices.at(vertexIndex)
  if (!vertex) return null
  const vx = vertex.x
  const vy = vertex.y

  const sampleVector = samples.reduce(
    (acc, p) => ({ x: acc.x + (p.x - vx), y: acc.y + (p.y - vy) }),
    { x: 0, y: 0 }
  )
  const sampleLen = Math.hypot(sampleVector.x, sampleVector.y)
  if (sampleLen < 1e-6) return null
  const sampleDir = { x: sampleVector.x / sampleLen, y: sampleVector.y / sampleLen }

  let best: { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null = null
  let bestDot = -Infinity
  for (let i = 0; i < es.segments.length; i++) {
    const seg = es.segments[i]
    let tangentField: 'tangentStart' | 'tangentEnd'
    let neighborIndex: number
    let tangent: Vector
    if (seg.start === vertexIndex) {
      tangentField = 'tangentStart'
      neighborIndex = seg.end
      tangent = seg.tangentStart
    } else if (seg.end === vertexIndex) {
      tangentField = 'tangentEnd'
      neighborIndex = seg.start
      tangent = seg.tangentEnd
    } else {
      continue
    }

    const neighbor = es.vertices[neighborIndex]

    const tangentLen = Math.hypot(tangent.x, tangent.y)
    const base = tangentLen > 1e-6 ? tangent : { x: neighbor.x - vx, y: neighbor.y - vy }
    const baseLen = Math.hypot(base.x, base.y)
    if (baseLen < 1e-6) continue
    const dir = { x: base.x / baseLen, y: base.y / baseLen }
    const dot = dir.x * sampleDir.x + dir.y * sampleDir.y
    if (dot > bestDot) {
      bestDot = dot
      best = { segmentIndex: i, tangentField }
    }
  }
  return best
}

export function handleBendHandleMove(
  d: Extract<DragState, { type: 'bend-handle' }>,
  cx: number,
  cy: number,
  event: MouseEvent,
  editor: Editor
): void {
  const nodeEditState = editor.getNodeEditState()
  const dx = cx - d.startX
  const dy = cy - d.startY
  if (Math.hypot(dx, dy) < 2) return
  if (d.lockedMode === null) {
    d.lockedMode = event.altKey ? 'independent' : 'symmetric'
  }
  if (d.dragSamples.length < 3) {
    d.dragSamples.push({ x: cx, y: cy })
  }
  if (d.targetSegmentIndex === null && d.dragSamples.length >= 3) {
    const target = resolveBendTargetHandle(nodeEditState, d.vertexIndex, d.dragSamples)
    if (target) {
      d.targetSegmentIndex = target.segmentIndex
      d.targetTangentField = target.tangentField
    }
  }
  if (d.targetSegmentIndex === null || d.targetTangentField === null) return
  editor.nodeEditBendHandle(
    d.vertexIndex,
    dx,
    dy,
    d.lockedMode === 'independent',
    d.targetSegmentIndex,
    d.targetTangentField
  )
}
