import type { CanvasKit, Path } from 'canvaskit-wasm'

import type { VectorPath } from '@open-pencil/scene-graph/vector-network'

import { forEachVerb } from '#core/canvas/paths/verbs'

/** A number as Figma writes path data: six significant digits, no trailing zeros. */
function figmaNumber(value: number): string {
  const rounded = Number(value.toPrecision(6))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function point(x: number, y: number): string {
  return `${figmaNumber(x)} ${figmaNumber(y)}`
}

/**
 * `path` as Figma's `fillGeometry` and `strokeGeometry` write it: `M0 0 L40 0 C…`, commands
 * spaced apart, each closed shape running back to its start before `Z`, and a conic as the cubic
 * Figma draws arcs with.
 */
export function figmaPathData(ck: CanvasKit, path: Path): string {
  const parts: string[] = []
  let start: [number, number] = [0, 0]
  let at: [number, number] = [0, 0]
  forEachVerb(ck, path, (verb, a) => {
    if (verb === ck.MOVE_VERB) {
      start = [a[0], a[1]]
      at = start
      parts.push(`M${point(a[0], a[1])}`)
    } else if (verb === ck.LINE_VERB) {
      at = [a[0], a[1]]
      parts.push(`L${point(a[0], a[1])}`)
    } else if (verb === ck.QUAD_VERB) {
      at = [a[2], a[3]]
      parts.push(`Q${point(a[0], a[1])} ${point(a[2], a[3])}`)
    } else if (verb === ck.CONIC_VERB) {
      // A conic of weight w is the cubic whose handles run 4w / 3(1 + w) of the way to its corner.
      const share = (4 * a[4]) / (3 * (1 + a[4]))
      const c1 = point(at[0] + (a[0] - at[0]) * share, at[1] + (a[1] - at[1]) * share)
      const c2 = point(a[2] + (a[0] - a[2]) * share, a[3] + (a[1] - a[3]) * share)
      at = [a[2], a[3]]
      parts.push(`C${c1} ${c2} ${point(a[2], a[3])}`)
    } else if (verb === ck.CUBIC_VERB) {
      at = [a[4], a[5]]
      parts.push(`C${point(a[0], a[1])} ${point(a[2], a[3])} ${point(a[4], a[5])}`)
    } else if (verb === ck.CLOSE_VERB) {
      if (point(...at) !== point(...start)) parts.push(`L${point(...start)}`)
      parts.push('Z')
      at = start
    }
  })
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
