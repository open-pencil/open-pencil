import type { CanvasKit, Path } from 'canvaskit-wasm'

import type { VectorPath } from '@open-pencil/scene-graph/vector-network'

import { tracePath } from '#core/canvas/paths/verbs'
import { svgPathSink } from '#core/io/formats/svg/paths'
import type { PathSink } from '#core/vector/path-helpers'

/** A number as Figma writes path data: six significant digits, no trailing zeros. */
function figmaNumber(value: number): number {
  const rounded = Number(value.toPrecision(6))
  return Object.is(rounded, -0) ? 0 : rounded
}

/** `sink`, but a shape that ends away from its start runs back to it before closing, as Figma's do. */
function closingAtStart(sink: PathSink): PathSink {
  let start = ''
  let at = ''
  const key = (x: number, y: number) => `${figmaNumber(x)} ${figmaNumber(y)}`
  let startPoint: [number, number] = [0, 0]
  return {
    moveTo(x, y) {
      start = at = key(x, y)
      startPoint = [x, y]
      sink.moveTo(x, y)
    },
    lineTo(x, y) {
      at = key(x, y)
      sink.lineTo(x, y)
    },
    cubicTo(x1, y1, x2, y2, x, y) {
      at = key(x, y)
      sink.cubicTo(x1, y1, x2, y2, x, y)
    },
    close() {
      if (at !== start) sink.lineTo(...startPoint)
      at = start
      sink.close()
    }
  }
}

/**
 * `path` as Figma's `fillGeometry` and `strokeGeometry` write it: `M0 0 L40 0 C…`, commands spaced
 * apart, six significant digits, curves as cubics, each closed shape running back to its start.
 */
export function figmaPathData(ck: CanvasKit, path: Path): string {
  const parts: string[] = []
  tracePath(ck, path, closingAtStart(svgPathSink(parts, figmaNumber)))
  return parts.join(' ')
}

/** `paths` as Figma's `VectorPaths`, each with its winding rule; empty paths are left out. */
export function figmaVectorPaths(ck: CanvasKit, paths: readonly Path[]): VectorPath[] {
  return paths.flatMap((path) => {
    const data = figmaPathData(ck, path)
    if (!data) return []
    const evenOdd = path.getFillType().value === ck.FillType.EvenOdd.value
    return [{ windingRule: evenOdd ? 'EVENODD' : 'NONZERO', data }]
  })
}
