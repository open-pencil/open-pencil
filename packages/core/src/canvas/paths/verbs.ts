import type { CanvasKit, Path, PathBuilder } from 'canvaskit-wasm'

import type { PathSink } from '#core/vector/path-helpers'

/** Calls `visit` with each verb of `path` and its coordinates, a conic's weight last. */
export function forEachVerb(
  ck: CanvasKit,
  path: Path,
  visit: (verb: number, args: Float32Array) => void
): void {
  const cmds = path.toCmds()
  const counts = new Map([
    [ck.MOVE_VERB, 2],
    [ck.LINE_VERB, 2],
    [ck.QUAD_VERB, 4],
    [ck.CONIC_VERB, 5],
    [ck.CUBIC_VERB, 6],
    [ck.CLOSE_VERB, 0]
  ])
  for (let index = 0; index < cmds.length;) {
    const verb = cmds[index]
    const count = counts.get(verb) ?? 0
    visit(verb, cmds.subarray(index + 1, index + 1 + count))
    index += 1 + count
  }
}

/** Adds one verb of a path, as `forEachVerb` gives it, to `builder`. */
export function appendVerb(
  ck: CanvasKit,
  builder: PathBuilder,
  verb: number,
  a: Float32Array
): void {
  if (verb === ck.MOVE_VERB) builder.moveTo(a[0], a[1])
  else if (verb === ck.LINE_VERB) builder.lineTo(a[0], a[1])
  else if (verb === ck.QUAD_VERB) builder.quadTo(a[0], a[1], a[2], a[3])
  else if (verb === ck.CONIC_VERB) builder.conicTo(a[0], a[1], a[2], a[3], a[4])
  else if (verb === ck.CUBIC_VERB) builder.cubicTo(a[0], a[1], a[2], a[3], a[4], a[5])
  else if (verb === ck.CLOSE_VERB) builder.close()
}

/**
 * Replays `path` into `sink`, which takes only cubics: a quad as the cubic it is, and a conic of
 * weight w as the cubic whose handles run 4w / 3(1 + w) of the way to its control point, which is
 * how arcs are drawn as cubics.
 */
export function tracePath(ck: CanvasKit, path: Path, sink: PathSink): void {
  let start: [number, number] = [0, 0]
  let at: [number, number] = [0, 0]
  forEachVerb(ck, path, (verb, a) => {
    if (verb === ck.MOVE_VERB) {
      start = at = [a[0], a[1]]
      sink.moveTo(a[0], a[1])
    } else if (verb === ck.LINE_VERB) {
      at = [a[0], a[1]]
      sink.lineTo(a[0], a[1])
    } else if (verb === ck.CUBIC_VERB) {
      at = [a[4], a[5]]
      sink.cubicTo(a[0], a[1], a[2], a[3], a[4], a[5])
    } else if (verb === ck.QUAD_VERB || verb === ck.CONIC_VERB) {
      const share = verb === ck.QUAD_VERB ? 2 / 3 : (4 * a[4]) / (3 * (1 + a[4]))
      const [x, y] = at
      at = [a[2], a[3]]
      sink.cubicTo(
        x + (a[0] - x) * share,
        y + (a[1] - y) * share,
        a[2] + (a[0] - a[2]) * share,
        a[3] + (a[1] - a[3]) * share,
        a[2],
        a[3]
      )
    } else if (verb === ck.CLOSE_VERB) {
      at = start
      sink.close()
    }
  })
}
