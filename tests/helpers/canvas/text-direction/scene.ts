import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

export function createNumericPrefixDirectionScene(graph: SceneGraph, pageId: string) {
  // Compare the automatic row with explicit LTR and RTL, in that order.
  const directions = ['AUTO', 'LTR', 'RTL'] as const
  return directions.map(
    (textDirection, index) =>
      graph.createNode('TEXT', pageId, {
        x: 20,
        y: 12 + 34 * index,
        width: 320,
        height: 32,
        text: '١٬٢٣٤ Invoice',
        fontFamily: 'Inter',
        fontSize: 22,
        fontWeight: 400,
        textAutoResize: 'NONE',
        textAlignHorizontal: 'LEFT',
        textDirection,
        fills: [solid(0, 0, 0)]
      }).id
  )
}
