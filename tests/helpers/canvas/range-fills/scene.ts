import type { Fill, SceneGraph } from '@open-pencil/scene-graph'

import { linearGradient, solid } from '../paints'

const INK = solid(0.08, 0.1, 0.18)
const GREEN = solid(0.1, 0.65, 0.25)
const RED_TO_BLUE = linearGradient([
  { r: 0.9, g: 0.1, b: 0.15, a: 1 },
  { r: 0.15, g: 0.2, b: 0.95, a: 1 }
])

/** "Open Pencil" rows whose second word has fills of its own over the layer's. */
const ROWS: { layer: Fill[]; range: Fill[] }[] = [
  { layer: [INK], range: [RED_TO_BLUE] },
  { layer: [INK], range: [GREEN, { ...RED_TO_BLUE, opacity: 0.5 }] },
  { layer: [RED_TO_BLUE], range: [GREEN] },
  { layer: [INK, solid(0.9, 0.1, 0.15, 0.5)], range: [solid(0.15, 0.2, 0.95, 0.5)] }
]

/** Four texts whose second word draws in fills of its own; returns their IDs. */
export function createRangeFillScene(graph: SceneGraph, pageId: string): string[] {
  return ROWS.map(
    ({ layer, range }, row) =>
      graph.createNode('TEXT', pageId, {
        name: `Range fills ${row + 1}`,
        x: 40,
        y: 30 + row * 72,
        width: 360,
        height: 64,
        text: 'Open Pencil',
        fontSize: 52,
        textAutoResize: 'HEIGHT',
        fills: layer,
        styleRuns: [{ start: 5, length: 6, style: { fills: range } }]
      }).id
  )
}
