import type { FigmaDerivedTextGlyph, GeometryPath, SceneNode } from '@open-pencil/scene-graph'
import { geometryBlobBounds, geometryCommandCoordCount } from '@open-pencil/scene-graph/geometry'

/**
 * Shift geometry command blobs in node space. Used when we grow the layout box
 * left/top so content must move with the new origin (parent-space art stays put).
 *
 * Command 0 (CLOSE) has zero coordinate pairs — must continue walking the blob.
 * Breaking on 0 left strokeGeometry only partially shifted while glyph x/y fully
 * shifted (DomeSticker white outline desynced from black fills).
 */
function translateGeometryPaths(paths: GeometryPath[], dx: number, dy: number): GeometryPath[] {
  if (dx === 0 && dy === 0) return paths
  return paths.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let offset = 0
    while (offset < scaled.length) {
      const command = scaled[offset++]
      const coords = geometryCommandCoordCount(command)
      // Unknown command → stop (avoids treating float bytes as opcodes).
      // CLOSE (0) returns 0 coords and continues.
      if (coords == null) break
      for (let i = 0; i < coords; i++) {
        if (offset + 8 > scaled.length) break
        dv.setFloat32(offset, dv.getFloat32(offset, true) + dx, true)
        dv.setFloat32(offset + 4, dv.getFloat32(offset + 4, true) + dy, true)
        offset += 8
      }
    }
    return {
      windingRule: g.windingRule,
      commandsBlob: scaled
    }
  })
}

interface BoxOverflow {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far painted geometry + glyph pads spill past the width×height box. */
function measurePathTextOverflow(
  props: Partial<SceneNode>,
  width: number,
  height: number
): BoxOverflow {
  const paths: GeometryPath[] = [...(props.fillGeometry ?? []), ...(props.strokeGeometry ?? [])]
  const geom = paths.length > 0 ? geometryBlobBounds(paths) : null

  let minX = geom?.x ?? 0
  let minY = geom?.y ?? 0
  let maxX = geom ? geom.x + geom.width : width
  let maxY = geom ? geom.y + geom.height : height

  // Baselines only — pad with fontSize so ascent/side-bearings are covered.
  for (const g of (props.figmaDerivedTextGlyphs as FigmaDerivedTextGlyph[] | null) ?? []) {
    const pad = g.fontSize || 0
    minX = Math.min(minX, g.x - pad * 0.25)
    minY = Math.min(minY, g.y - pad)
    maxX = Math.max(maxX, g.x + pad)
    maxY = Math.max(maxY, g.y + pad * 0.35)
  }

  const pad = 1
  return {
    left: Math.max(0, -minX + (minX < 0 ? pad : 0)),
    top: Math.max(0, -minY + (minY < 0 ? pad : 0)),
    right: Math.max(0, maxX - width + (maxX > width ? pad : 0)),
    bottom: Math.max(0, maxY - height + (maxY > height ? pad : 0))
  }
}

/** Shift local geometry + glyph baselines by (dx, dy) after the origin moved. */
function shiftPathTextGeometry(props: Partial<SceneNode>, dx: number, dy: number): void {
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

/**
 * Figma often sizes the TEXT_PATH layout box tighter than the painted outlines
 * (DomeSticker strokeGeometry minX ≈ -37). That is fine inside Figma's own
 * painter, but our frames honor `clipsContent` against child *layout* extents
 * during resize/cull — overflowing lettering on the left/bottom got clipped.
 *
 * Grow width/height to cover strokeGeometry + glyph pads, then shift local
 * geometry by (dx, dy) and compensate with x/y so the design does not jump.
 */
export function expandPathTextLayoutBox(props: Partial<SceneNode> & { nodeType: string }): void {
  if (props.nodeType !== 'TEXT') return
  if (props.source?.fig.kiwiNodeType !== 'TEXT_PATH') return

  const width = props.width ?? 0
  const height = props.height ?? 0
  // The layout path (rawNodeFields vectorData) maps onto the ORIGINAL Figma
  // box; anchor it before the box grows so reflow can evaluate the path in
  // current node-local coordinates.
  props.textPathBox = { x: 0, y: 0, width, height }
  const overflow = measurePathTextOverflow(props, width, height)
  if (overflow.left === 0 && overflow.top === 0 && overflow.right === 0 && overflow.bottom === 0) {
    return
  }

  // New origin is (oldOrigin - (overflowLeft, overflowTop)) in parent space;
  // add the same delta to local geometry so world positions are unchanged.
  const dx = overflow.left
  const dy = overflow.top
  props.x = (props.x ?? 0) - dx
  props.y = (props.y ?? 0) - dy
  props.width = width + overflow.left + overflow.right
  props.height = height + overflow.top + overflow.bottom

  if (dx !== 0 || dy !== 0) {
    props.textPathBox = { x: dx, y: dy, width, height }
    shiftPathTextGeometry(props, dx, dy)
  }
}
