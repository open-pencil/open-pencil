import type { SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import { transformVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import type { EditorContext } from '#core/editor/types'
import { computeAccurateBounds } from '#core/vector'

export type CreateShape = (
  type: 'VECTOR',
  x: number,
  y: number,
  w: number,
  h: number,
  parentId?: string
) => string

/** A network drawn in canvas coordinates, mapped into the axes of the layer it goes into. */
function inParentSpace(ctx: EditorContext, network: VectorNetwork, parentId?: string) {
  const parent = parentId ? ctx.graph.getNode(parentId) : undefined
  if (!parent || parent.type === 'CANVAS') return network
  const toLocal = Matrix.invert(getWorldMatrix(parent, ctx.graph))
  return toLocal ? transformVectorNetwork(toLocal, network) : network
}

/**
 * Adds a drawn path as a vector layer: `network` is in canvas coordinates, and the layer is
 * placed at the path's bounds in `parentId`, the current page when omitted, with the path moved
 * to start at its own origin. Pen and pencil strokes both finish here.
 */
export function createVectorFromNetwork(
  ctx: EditorContext,
  createShape: CreateShape,
  network: VectorNetwork,
  style: Partial<SceneNode>,
  parentId?: string
): string {
  const local = inParentSpace(ctx, network, parentId)
  const bounds = computeAccurateBounds(local)
  const vectorNetwork: VectorNetwork = {
    vertices: local.vertices.map((v) => ({ ...v, x: v.x - bounds.x, y: v.y - bounds.y })),
    segments: local.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    })),
    regions: local.regions
  }
  const nodeId = createShape('VECTOR', bounds.x, bounds.y, bounds.width, bounds.height, parentId)
  ctx.graph.updateNode(nodeId, { ...style, vectorNetwork })
  return nodeId
}
