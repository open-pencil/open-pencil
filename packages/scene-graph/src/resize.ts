import type { Rect } from './primitives'
import type { ConstraintType, SceneNode, VectorNetwork } from './types'
import { cloneVectorNetwork } from './vector-network'

export type ResizeSnapshot = Pick<SceneNode, 'x' | 'y' | 'width' | 'height' | 'vectorNetwork'>

interface ResizeGraph {
  getNode(id: string): SceneNode | undefined
}

const CONSTRAINT_CONTAINER_TYPES = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'GROUP',
  'BOOLEAN_OPERATION'
])

function constrainedAxis(
  position: number,
  size: number,
  parentBefore: number,
  parentAfter: number,
  constraint: ConstraintType
): { position: number; size: number } {
  const delta = parentAfter - parentBefore
  if (constraint === 'MAX') return { position: position + delta, size }
  if (constraint === 'CENTER') return { position: position + delta / 2, size }
  if (constraint === 'STRETCH') return { position, size: Math.max(1, size + delta) }
  if (constraint === 'SCALE' && parentBefore > 0) {
    const scale = parentAfter / parentBefore
    return { position: position * scale, size: Math.max(1, size * scale) }
  }
  return { position, size }
}

export function constrainedChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>,
  horizontal: ConstraintType,
  vertical: ConstraintType
): Rect {
  const x = constrainedAxis(child.x, child.width, parentBefore.width, parentAfter.width, horizontal)
  const y = constrainedAxis(
    child.y,
    child.height,
    parentBefore.height,
    parentAfter.height,
    vertical
  )
  return {
    x: Math.round(x.position),
    y: Math.round(y.position),
    width: Math.round(x.size),
    height: Math.round(y.size)
  }
}

export function scaledChildRect(
  child: Rect,
  parentBefore: Pick<Rect, 'width' | 'height'>,
  parentAfter: Pick<Rect, 'width' | 'height'>
): Rect {
  return constrainedChildRect(child, parentBefore, parentAfter, 'SCALE', 'SCALE')
}

export function scaleVectorNetworkForResize(
  vectorNetwork: VectorNetwork | null,
  originalWidth: number,
  originalHeight: number,
  width: number,
  height: number
): VectorNetwork | null {
  if (!vectorNetwork || originalWidth <= 0 || originalHeight <= 0) return null

  const scaleX = width / originalWidth
  const scaleY = height / originalHeight
  if (scaleX === 1 && scaleY === 1) return null

  return {
    vertices: vectorNetwork.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x * scaleX,
      y: vertex.y * scaleY
    })),
    segments: vectorNetwork.segments.map((segment) => ({
      ...segment,
      tangentStart: {
        x: segment.tangentStart.x * scaleX,
        y: segment.tangentStart.y * scaleY
      },
      tangentEnd: {
        x: segment.tangentEnd.x * scaleX,
        y: segment.tangentEnd.y * scaleY
      }
    })),
    regions: vectorNetwork.regions
  }
}

export function collectResizeDescendants(
  graph: ResizeGraph,
  rootId: string
): Map<string, ResizeSnapshot> | null {
  const root = graph.getNode(rootId)
  if (!root || !CONSTRAINT_CONTAINER_TYPES.has(root.type)) return null
  const snapshots = new Map<string, ResizeSnapshot>()

  const collect = (parentId: string) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      snapshots.set(childId, {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        vectorNetwork: child.vectorNetwork ? cloneVectorNetwork(child.vectorNetwork) : null
      })
      collect(childId)
    }
  }

  collect(rootId)
  return snapshots.size > 0 ? snapshots : null
}

export function computeConstrainedResizeChanges(
  graph: ResizeGraph,
  rootId: string,
  rootBefore: Pick<Rect, 'width' | 'height'>,
  rootAfter: Pick<Rect, 'width' | 'height'>,
  originals: ReadonlyMap<string, ResizeSnapshot>
): Map<string, Partial<SceneNode>> {
  const changes = new Map<string, Partial<SceneNode>>()

  const compute = (
    parentId: string,
    parentBefore: Pick<Rect, 'width' | 'height'>,
    parentAfter: Pick<Rect, 'width' | 'height'>
  ) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    const scalesChildren = parent.type === 'GROUP' || parent.type === 'BOOLEAN_OPERATION'
    for (const childId of parent.childIds) {
      const original = originals.get(childId)
      const child = graph.getNode(childId)
      if (!original || !child) continue
      const isInFlow = parent.layoutMode !== 'NONE' && child.layoutPositioning !== 'ABSOLUTE'
      if (isInFlow) {
        compute(childId, original, child)
        continue
      }
      const rect = scalesChildren
        ? scaledChildRect(original, parentBefore, parentAfter)
        : constrainedChildRect(
            original,
            parentBefore,
            parentAfter,
            child.horizontalConstraint,
            child.verticalConstraint
          )
      const childChanges: Partial<SceneNode> = { ...rect }
      const vectorNetwork = scaleVectorNetworkForResize(
        original.vectorNetwork,
        original.width,
        original.height,
        rect.width,
        rect.height
      )
      if (vectorNetwork) childChanges.vectorNetwork = vectorNetwork
      changes.set(childId, childChanges)
      compute(childId, original, rect)
    }
  }

  compute(rootId, rootBefore, rootAfter)
  return changes
}
