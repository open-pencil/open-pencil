import type { CanvasKit, Path } from '@open-pencil/canvaskit'
import { svgPathSink } from '@open-pencil/scene-graph/paths'

import { tracePath } from '#core/canvas/paths/verbs'

/**
 * A path as SVG path data at full precision, each conic one cubic. Skia keeps rounded corners and
 * ellipses as conics, which its own `toSVGString` breaks into dozens of quads, so a vector made
 * from it would carry dozens of points per corner where Figma's has one curve (Figma desktop 126).
 */
export function curvePathData(ck: CanvasKit, path: Path): string {
  const parts: string[] = []
  tracePath(
    ck,
    path,
    svgPathSink(parts, (value) => value)
  )
  return parts.join('')
}
