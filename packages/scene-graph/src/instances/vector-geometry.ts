import { isEqual } from 'es-toolkit/predicate'

import { cloneVectorNetwork, copyGeometryPaths, scaleGeometryPaths } from '../copy'
import type { SceneNode, VectorNetwork } from '../types'
import { transformVectorNetwork } from '../vector-network'

/** How far apart two paths' points may be and still count as one path, in pixels. */
const PATH_TOLERANCE = 1e-3

/** The stroke fields a vector's stroke outline is drawn from. */
const STROKE_OUTLINE_FIELDS = [
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'strokeMiterLimit',
  'dashPattern'
] as const

const near = (a: number, b: number) => Math.abs(a - b) <= PATH_TOLERANCE

/** Whether two paths are one, up to the float error that files and scaling leave. */
function samePath(a: VectorNetwork | null, b: VectorNetwork | null): boolean {
  if (!a || !b) return a === b
  if (a.vertices.length !== b.vertices.length || a.segments.length !== b.segments.length)
    return false
  const sameVertices = a.vertices.every((vertex, index) => {
    const { x, y, ...rest } = vertex
    const { x: otherX, y: otherY, ...otherRest } = b.vertices[index]
    return near(x, otherX) && near(y, otherY) && isEqual(rest, otherRest)
  })
  const sameSegments = a.segments.every((segment, index) => {
    const other = b.segments[index]
    return (
      segment.start === other.start &&
      segment.end === other.end &&
      near(segment.tangentStart.x, other.tangentStart.x) &&
      near(segment.tangentStart.y, other.tangentStart.y) &&
      near(segment.tangentEnd.x, other.tangentEnd.x) &&
      near(segment.tangentEnd.y, other.tangentEnd.y)
    )
  })
  return sameVertices && sameSegments && isEqual(a.regions, b.regions)
}

/**
 * Gives a vector's copy its component's path, which Figma refuses to override in an instance
 * ("vector-data"), so every edit to the path reaches the copies, drawn at the size the copy ends
 * up with. A copy whose path already matches keeps its own outlines, which may differ from the
 * component's where the instance overrides its fills or strokes. A changed path brings the
 * component's outlines with it, the stroke's only while the copy strokes as the component does;
 * otherwise the canvas draws the stroke from the new path.
 */
export function followVectorGeometry(
  updates: Partial<SceneNode>,
  copy: SceneNode,
  source: SceneNode
): void {
  if (source.type !== 'VECTOR') return
  const width = updates.width ?? copy.width
  const height = updates.height ?? copy.height
  // A straight line has no extent across it, so that axis keeps its scale.
  const sx = source.width > 0 ? width / source.width : 1
  const sy = source.height > 0 ? height / source.height : 1
  const scaled = sx !== 1 || sy !== 1
  const scaledNetwork = (network: VectorNetwork) =>
    scaled
      ? transformVectorNetwork([sx, 0, 0, 0, sy, 0, 0, 0, 1], network)
      : cloneVectorNetwork(network)
  const network = source.vectorNetwork ? scaledNetwork(source.vectorNetwork) : null
  if (samePath(copy.vectorNetwork, network)) return
  const outlines = (paths: SceneNode['fillGeometry']) =>
    scaled ? scaleGeometryPaths(paths, sx, sy) : copyGeometryPaths(paths)
  const strokesAlike = STROKE_OUTLINE_FIELDS.every((field) =>
    isEqual(updates[field] ?? copy[field], source[field])
  )
  updates.vectorNetwork = network
  updates.fillGeometry = outlines(source.fillGeometry)
  updates.strokeGeometry = strokesAlike ? outlines(source.strokeGeometry) : []
}
