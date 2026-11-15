import type { Path } from '@open-pencil/canvaskit'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'

/** One path covering every path given, or null when Skia cannot unite them. */
export function unitedPath(r: SkiaRenderer, regions: Path[]): Path | null {
  let merged = regions[0].copy()
  for (let index = 1; index < regions.length; index++) {
    const union = r.ck.Path.MakeFromOp(merged, regions[index], r.ck.PathOp.Union)
    merged.delete()
    if (!union) {
      return null
    }
    merged = union
  }
  return merged
}

function unitedInPairs(r: SkiaRenderer, paths: readonly Path[]): Path | null {
  let level = paths.map((path) => path.copy())
  while (level.length > 1) {
    const next: Path[] = []
    for (let index = 0; index < level.length; index += 2) {
      const [first, second] = [level[index], level.at(index + 1)]
      if (!second) {
        next.push(first)
        continue
      }
      const union = r.ck.Path.MakeFromOp(first, second, r.ck.PathOp.Union)
      first.delete()
      second.delete()
      if (!union) {
        for (const path of [...next, ...level.slice(index + 2)]) {
          path.delete()
        }
        return null
      }
      next.push(union)
    }
    level = next
  }
  return level.at(0) ?? null
}

function nonzeroWithLoose(r: SkiaRenderer, united: Path, loose: readonly Path[]): Path {
  const winding = united.makeAsWinding() ?? united.copy()
  united.delete()
  if (loose.length === 0) {
    return winding
  }
  const path = new r.ck.PathBuilder()
  path.addPath(winding)
  winding.delete()
  for (const source of loose) {
    path.addPath(source)
  }
  return path.detachAndDelete()
}

export function unitedOutline(
  r: SkiaRenderer,
  key: string,
  areas: readonly Path[],
  loose: readonly Path[] = []
): Path | null {
  const cached = r.nodePaths.strokeOutline.get(key)
  if (cached) {
    return cached[0]
  }
  const united = areas.length > 0 ? unitedInPairs(r, areas) : null
  if (!united) {
    return null
  }
  const outline = nonzeroWithLoose(r, united, loose)
  r.nodePaths.store(r.nodePaths.strokeOutline, key, [outline])
  return outline
}
