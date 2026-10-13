import {
  transformVectorNetwork,
  type SceneGraph,
  type SceneNode,
  type VectorNetwork
} from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { computeAccurateBounds } from './curve-math'
import { regenerateFillGeometry } from './fill-geometry'

export type VectorPathChanges = Pick<
  SceneNode,
  'x' | 'y' | 'width' | 'height' | 'vectorNetwork' | 'fillGeometry' | 'strokeGeometry'
>

/**
 * What gives a vector layer a path drawn in page coordinates while keeping its rotation and flips:
 * the path moves into the layer's own frame, the layer's box fits it, and the fill geometry
 * follows. Null when the layer's transform cannot be inverted.
 */
export function vectorChangesFromPagePath(
  graph: SceneGraph,
  node: SceneNode,
  pagePath: VectorNetwork
): VectorPathChanges | null {
  const inverse = Matrix.invert(getWorldMatrix(node, graph))
  if (!inverse) return null
  const localNetwork = transformVectorNetwork(inverse, pagePath)
  const bounds = computeAccurateBounds(localNetwork)
  const relativeNetwork: VectorNetwork = {
    vertices: localNetwork.vertices.map((v) => ({ ...v, x: v.x - bounds.x, y: v.y - bounds.y })),
    segments: localNetwork.segments,
    regions: localNetwork.regions
  }
  // The layer rotates and flips about its center, so with those kept the new x and y follow from
  // where the new geometry's center lands in the parent, through the old local matrix: the
  // geometry itself has not moved.
  const center = Matrix.mapPoint(getNodeLocalMatrix(node), {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  })
  return {
    x: center.x - bounds.width / 2,
    y: center.y - bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
    vectorNetwork: relativeNetwork,
    // Fills draw from fillGeometry blobs when present, so rebuild them from the new path.
    fillGeometry: regenerateFillGeometry(relativeNetwork, node.fillGeometry),
    // Imported stroke outlines no longer match; strokes come from the path instead.
    strokeGeometry: []
  }
}
