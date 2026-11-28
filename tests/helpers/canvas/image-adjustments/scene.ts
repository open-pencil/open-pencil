import type { ImageFilters, SceneGraph } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'

/** No adjustment, each alone at a strong setting, and all seven together. */
const TILES: ImageFilters[] = [
  {},
  { exposure: 0.6 },
  { exposure: -0.6 },
  { contrast: 1 },
  { contrast: -1 },
  { saturation: 1 },
  { saturation: -1 },
  { temperature: 1 },
  { tint: -1 },
  { highlights: -1 },
  { shadows: 1 },
  {
    exposure: 0.25,
    contrast: 0.3,
    saturation: 0.4,
    temperature: -0.3,
    tint: 0.2,
    highlights: -0.4,
    shadows: 0.35
  }
]

/** One image, given as its encoded bytes, in a grid of four columns, one tile per adjustment. */
export function createImageAdjustmentsScene(graph: SceneGraph, pageId: string, bytes: number[]) {
  const image = Uint8Array.from(bytes)
  const hash = computeImageHash(image)
  graph.images.set(hash, image)
  return TILES.map(
    (filters, index) =>
      graph.createNode('RECTANGLE', pageId, {
        name: `Adjusted image ${index}`,
        x: 40 + (index % 4) * 112,
        y: 40 + Math.floor(index / 4) * 112,
        width: 102,
        height: 101,
        fills: [
          {
            type: 'IMAGE',
            imageHash: hash,
            imageScaleMode: 'FIT',
            color: { r: 0, g: 0, b: 0, a: 1 },
            visible: true,
            opacity: 1,
            filters
          }
        ]
      }).id
  )
}
