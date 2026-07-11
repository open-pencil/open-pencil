import type { FigmaDerivedTextGlyph, GeometryPath, SceneNode } from '@open-pencil/scene-graph'
import { geometryBlobBounds } from '@open-pencil/scene-graph/geometry'

/** Translate path command blob coordinates by (dx, dy). */
function translateGeometryPaths(paths: GeometryPath[], dx: number, dy: number): GeometryPath[] {
  if (dx === 0 && dy === 0) return paths
  return paths.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let offset = 0
    while (offset < scaled.length) {
      const command = scaled[offset++]
      let coords = 0
      if (command === 1 || command === 2) coords = 1
      else if (command === 4) coords = 3
      for (let i = 0; i < coords; i++) {
        if (offset + 8 > scaled.length) break
        dv.setFloat32(offset, dv.getFloat32(offset, true) + dx, true)
        dv.setFloat32(offset + 4, dv.getFloat32(offset + 4, true) + dy, true)
        offset += 8
      }
    }
    return {
      windingRule: g.windingRule,
      commandsBlob: scaled,
      ...(g.styleID != null ? { styleID: g.styleID } : {}),
      ...(g.fills ? { fills: g.fills } : {})
    }
  })
}

/**
 * Path text (TEXT_PATH) stores glyph/stroke outlines that often extend outside
 * the node's layout box (negative x, past height). Parent frames with
 * clipsContent then cut the left/bottom of the lettering. Expand the box and
 * re-home geometry so the visual stays put while fitting inside the node.
 */
export function expandPathTextLayoutBox(props: Partial<SceneNode> & { nodeType: string }): void {
  if (props.nodeType !== 'TEXT') return
  if (props.source?.fig?.kiwiNodeType !== 'TEXT_PATH') return

  const width = props.width ?? 0
  const height = props.height ?? 0
  const paths: GeometryPath[] = [
    ...((props.fillGeometry as GeometryPath[] | undefined) ?? []),
    ...((props.strokeGeometry as GeometryPath[] | undefined) ?? [])
  ]
  const geom = paths.length > 0 ? geometryBlobBounds(paths) : null

  let minX = geom?.x ?? 0
  let minY = geom?.y ?? 0
  let maxX = geom ? geom.x + geom.width : width
  let maxY = geom ? geom.y + geom.height : height

  // Glyph positions are baselines; pad by fontSize so outlines aren't tight.
  for (const g of (props.figmaDerivedTextGlyphs as FigmaDerivedTextGlyph[] | null) ?? []) {
    const pad = g.fontSize || 0
    minX = Math.min(minX, g.x - pad * 0.25)
    minY = Math.min(minY, g.y - pad)
    maxX = Math.max(maxX, g.x + pad)
    maxY = Math.max(maxY, g.y + pad * 0.35)
  }

  const pad = 1
  const overflowLeft = Math.max(0, -minX + (minX < 0 ? pad : 0))
  const overflowTop = Math.max(0, -minY + (minY < 0 ? pad : 0))
  const overflowRight = Math.max(0, maxX - width + (maxX > width ? pad : 0))
  const overflowBottom = Math.max(0, maxY - height + (maxY > height ? pad : 0))
  if (overflowLeft === 0 && overflowTop === 0 && overflowRight === 0 && overflowBottom === 0) {
    return
  }

  const dx = overflowLeft
  const dy = overflowTop
  props.x = (props.x ?? 0) - dx
  props.y = (props.y ?? 0) - dy
  props.width = width + overflowLeft + overflowRight
  props.height = height + overflowTop + overflowBottom

  if (dx !== 0 || dy !== 0) {
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
}
