import type { GeometryPath, SceneNode } from '@open-pencil/scene-graph'
import { transformGeometryPaths } from '@open-pencil/scene-graph/copy'
import { geometryBlobBounds } from '@open-pencil/scene-graph/geometry'

/**
 * Shift geometry command blobs in node space. Used when we grow the layout box
 * left/top so content must move with the new origin (parent-space art stays put).
 */
function translateGeometryPaths(paths: GeometryPath[], dx: number, dy: number): GeometryPath[] {
  if (dx === 0 && dy === 0) return paths
  return transformGeometryPaths(paths, 1, 0, 0, 1, dx, dy)
}

/**
 * Figma often sizes the TEXT_PATH layout box tighter than the painted outlines
 * (DomeSticker strokeGeometry minX ≈ -37). That is fine inside Figma's own
 * painter, but our frames honor `clipsContent` against child *layout* extents
 * during resize/cull — overflowing lettering on the left/bottom got clipped.
 *
 * Grow width/height to cover strokeGeometry + glyph pads, then shift local
 * geometry by (dx, dy) and compensate with x/y so the design does not jump.
 */
interface ContentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function pathTextContentBounds(
  props: Partial<SceneNode>,
  width: number,
  height: number
): ContentBounds {
  const paths: GeometryPath[] = [...(props.fillGeometry ?? []), ...(props.strokeGeometry ?? [])]
  const geom = paths.length > 0 ? geometryBlobBounds(paths) : null

  let minX = geom?.x ?? 0
  let minY = geom?.y ?? 0
  let maxX = geom ? geom.x + geom.width : width
  let maxY = geom ? geom.y + geom.height : height

  // Baselines only — pad with fontSize so ascent/side-bearings are covered.
  for (const g of props.figmaDerivedTextGlyphs ?? []) {
    const pad = g.fontSize || 0
    minX = Math.min(minX, g.x - pad * 0.25)
    minY = Math.min(minY, g.y - pad)
    maxX = Math.max(maxX, g.x + pad)
    maxY = Math.max(maxY, g.y + pad * 0.35)
  }
  return { minX, minY, maxX, maxY }
}

/** Shift local geometry so world positions survive the origin move. */
function shiftLocalGeometry(props: Partial<SceneNode>, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  if (props.strokeGeometry && props.strokeGeometry.length > 0) {
    props.strokeGeometry = translateGeometryPaths(props.strokeGeometry, dx, dy)
  }
  if (props.fillGeometry && props.fillGeometry.length > 0) {
    props.fillGeometry = translateGeometryPaths(props.fillGeometry, dx, dy)
  }
  if (props.figmaDerivedTextGlyphs?.length) {
    props.figmaDerivedTextGlyphs = props.figmaDerivedTextGlyphs.map((g) => ({
      ...g,
      x: g.x + dx,
      y: g.y + dy
    }))
  }
}

export function expandPathTextLayoutBox(props: Partial<SceneNode> & { nodeType: string }): void {
  if (props.nodeType !== 'TEXT') return
  if (props.source?.fig.kiwiNodeType !== 'TEXT_PATH') return

  const width = props.width ?? 0
  const height = props.height ?? 0
  const { minX, minY, maxX, maxY } = pathTextContentBounds(props, width, height)

  const pad = 1
  const overflowLeft = Math.max(0, -minX + (minX < 0 ? pad : 0))
  const overflowTop = Math.max(0, -minY + (minY < 0 ? pad : 0))
  const overflowRight = Math.max(0, maxX - width + (maxX > width ? pad : 0))
  const overflowBottom = Math.max(0, maxY - height + (maxY > height ? pad : 0))
  if (overflowLeft === 0 && overflowTop === 0 && overflowRight === 0 && overflowBottom === 0) {
    return
  }

  // New origin is (oldOrigin - (overflowLeft, overflowTop)) in parent space;
  // add the same delta to local geometry so world positions are unchanged.
  props.x = (props.x ?? 0) - overflowLeft
  props.y = (props.y ?? 0) - overflowTop
  props.width = width + overflowLeft + overflowRight
  props.height = height + overflowTop + overflowBottom
  shiftLocalGeometry(props, overflowLeft, overflowTop)
}
