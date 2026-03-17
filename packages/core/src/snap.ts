import { rotatedBBox } from './geometry'
import type { SceneNode } from './scene-graph'
import type { Rect } from './types'

const SNAP_THRESHOLD = 5

export interface SnapGuide {
  axis: 'x' | 'y'
  position: number
  from: number
  to: number
}

export interface SnapResult {
  dx: number
  dy: number
  guides: SnapGuide[]
}

function getEdges(node: SceneNode) {
  return rotatedBBox(node.x, node.y, node.width, node.height, node.rotation)
}

export function computeSnap(
  movingIds: Set<string>,
  movingBounds: Rect,
  allNodes: SceneNode[]
): SnapResult {
  const targets = allNodes.filter((n) => !movingIds.has(n.id))
  if (targets.length === 0) return { dx: 0, dy: 0, guides: [] }

  const m = {
    left: movingBounds.x,
    right: movingBounds.x + movingBounds.width,
    centerX: movingBounds.x + movingBounds.width / 2,
    top: movingBounds.y,
    bottom: movingBounds.y + movingBounds.height,
    centerY: movingBounds.y + movingBounds.height / 2
  }

  let bestDx = Infinity
  let bestDy = Infinity
  const guides: SnapGuide[] = []

  for (const target of targets) {
    const t = getEdges(target)

    // X-axis snapping: left-to-left, left-to-right, right-to-left, right-to-right, center-to-center
    const xPairs: [number, number][] = [
      [m.left, t.left],
      [m.left, t.right],
      [m.right, t.left],
      [m.right, t.right],
      [m.centerX, t.centerX]
    ]

    for (const [mVal, tVal] of xPairs) {
      const d = tVal - mVal
      if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) <= Math.abs(bestDx)) {
        if (Math.abs(d) < Math.abs(bestDx)) {
          bestDx = d
          guides.length = guides.filter((g) => g.axis === 'y').length
            ? guides.length
            : guides.length
          // Remove old x guides if we found a closer snap
          for (let i = guides.length - 1; i >= 0; i--) {
            if (guides[i].axis === 'x') guides.splice(i, 1)
          }
        }
        if (Math.abs(d) === Math.abs(bestDx)) {
          const minY = Math.min(m.top, t.top)
          const maxY = Math.max(m.bottom, t.bottom)
          guides.push({ axis: 'x', position: tVal, from: minY, to: maxY })
        }
      }
    }

    // Y-axis snapping
    const yPairs: [number, number][] = [
      [m.top, t.top],
      [m.top, t.bottom],
      [m.bottom, t.top],
      [m.bottom, t.bottom],
      [m.centerY, t.centerY]
    ]

    for (const [mVal, tVal] of yPairs) {
      const d = tVal - mVal
      if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) <= Math.abs(bestDy)) {
        if (Math.abs(d) < Math.abs(bestDy)) {
          for (let i = guides.length - 1; i >= 0; i--) {
            if (guides[i].axis === 'y') guides.splice(i, 1)
          }
          bestDy = d
        }
        if (Math.abs(d) === Math.abs(bestDy)) {
          const minX = Math.min(m.left, t.left)
          const maxX = Math.max(m.right, t.right)
          guides.push({ axis: 'y', position: tVal, from: minX, to: maxX })
        }
      }
    }
  }

  return {
    dx: Math.abs(bestDx) <= SNAP_THRESHOLD ? bestDx : 0,
    dy: Math.abs(bestDy) <= SNAP_THRESHOLD ? bestDy : 0,
    guides
  }
}

export function computeSelectionBounds(nodes: SceneNode[]): Rect | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    const edges = getEdges(n)
    minX = Math.min(minX, edges.left)
    minY = Math.min(minY, edges.top)
    maxX = Math.max(maxX, edges.right)
    maxY = Math.max(maxY, edges.bottom)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
