import type { Path } from '@open-pencil/canvaskit'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { placedPath, windingRuleOf } from '#core/canvas/boolean'
import type { SkiaRenderer } from '#core/canvas/renderer'

import { curvePathData } from './svg-data'

/** The box around `paths`, a straight line keeping its zero side; null for no paths. */
export function pathBounds(paths: readonly Path[]): Rect | null {
  if (paths.length === 0) return null
  return computeBounds(
    paths.map((path) => {
      const [left, top, right, bottom] = path.getBounds()
      return { x: left, y: top, width: right - left, height: bottom - top }
    })
  )
}

/** A path as a vector network, moved so `origin` is its network's origin. */
export function pathToNetwork(r: SkiaRenderer, path: Path, origin: Vector): VectorNetwork {
  const moved = placedPath(r, path, r.ck.Matrix.translated(-origin.x, -origin.y))
  const network = parseSVGPath(curvePathData(r.ck, moved), windingRuleOf(r, moved))
  moved.delete()
  return network
}
