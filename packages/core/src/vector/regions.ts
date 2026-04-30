import type { VectorRegion, VectorSegment } from '#core/scene-graph'

export function remapRegions(
  regions: VectorRegion[],
  indexMap: Map<number, number | null>
): VectorRegion[] {
  const result: VectorRegion[] = []

  for (const region of regions) {
    const newLoops: number[][] = []
    for (const loop of region.loops) {
      const newLoop: number[] = []
      for (const idx of loop) {
        const mapped = indexMap.get(idx)
        if (mapped == null) continue
        if (newLoop.length > 0 && newLoop[newLoop.length - 1] === mapped) continue
        newLoop.push(mapped)
      }
      if (newLoop.length > 1 && newLoop[0] === newLoop[newLoop.length - 1]) {
        newLoop.pop()
      }
      if (newLoop.length >= 2) newLoops.push(newLoop)
    }
    if (newLoops.length > 0) {
      result.push({ ...region, loops: newLoops })
    }
  }

  return result
}

export function reindexRegionLoops(
  regions: VectorRegion[],
  oldSegIndex: number,
  newSegIndices: number[],
  segments?: VectorSegment[]
): VectorRegion[] {
  return regions.map((region) => ({
    ...region,
    loops: region.loops.map((loop) => {
      const result: number[] = []
      for (let i = 0; i < loop.length; i++) {
        if (loop[i] !== oldSegIndex) {
          result.push(loop[i])
          continue
        }

        if (!segments || newSegIndices.length < 2) {
          result.push(...newSegIndices)
          continue
        }

        const origSeg = segments[oldSegIndex]
        const nextIdx = loop[(i + 1) % loop.length]
        const nextSeg = segments[nextIdx]
        const endConnectsToNext = origSeg.end === nextSeg.start || origSeg.end === nextSeg.end

        if (endConnectsToNext) {
          result.push(...newSegIndices)
        } else {
          result.push(...[...newSegIndices].reverse())
        }
      }
      return result
    })
  }))
}
