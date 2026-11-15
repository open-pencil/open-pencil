import type { Fill, SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { gradientTransformInBox, isGradientFill } from '@open-pencil/scene-graph/gradient'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'
import { transformVectorNetwork } from '@open-pencil/scene-graph/vector-network'

import { computeAccurateBounds } from './curve-math'
import { regenerateFillGeometry } from './fill-geometry'

export type VectorPathChanges = Pick<
  SceneNode,
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'vectorNetwork'
  | 'fillGeometry'
  | 'strokeGeometry'
  | 'fills'
  | 'strokes'
>

/**
 * A layer's paints with its gradients kept where they were on the canvas rather than stretched to
 * its new box `bounds`, in its old frame, as Figma keeps them when a path edit resizes the layer.
 * A box flat on either axis keeps them as they are: a gradient squeezed into it could not be
 * inverted, so it would neither draw nor come back when the path widens again.
 */
function paintsKeptInPlace(node: SceneNode, bounds: Rect): Pick<SceneNode, 'fills' | 'strokes'> {
  const flat = !(node.width > 0 && node.height > 0 && bounds.width > 0 && bounds.height > 0)
  if (flat) return { fills: node.fills, strokes: node.strokes }
  const box = {
    x: bounds.x / node.width,
    y: bounds.y / node.height,
    width: bounds.width / node.width,
    height: bounds.height / node.height
  }
  return {
    fills: gradientsKeptInPlace(node.fills, box),
    strokes: gradientsKeptInPlace(node.strokes, box)
  }
}

/** `paints` with each gradient kept where it was on the canvas as the layer's box becomes `box`. */
function gradientsKeptInPlace<T extends Fill>(paints: T[], box: Rect): T[] {
  return paints.map((paint) =>
    isGradientFill(paint.type) && paint.gradientTransform
      ? { ...paint, gradientTransform: gradientTransformInBox(paint.gradientTransform, box) }
      : paint
  )
}

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
    strokeGeometry: [],
    ...paintsKeptInPlace(node, bounds)
  }
}
