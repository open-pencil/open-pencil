import type { CanvasKit, Path } from 'canvaskit-wasm'

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
