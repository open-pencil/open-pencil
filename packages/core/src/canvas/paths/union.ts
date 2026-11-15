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
