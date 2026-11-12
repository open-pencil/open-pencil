import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { vectorChangesFromPagePath } from '@open-pencil/core/vector'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import { IDENTITY_GRADIENT_TRANSFORM } from '@open-pencil/scene-graph/gradient'

/** A closed path through `points`, in page coordinates. */
function polygon(points: [number, number][]): VectorNetwork {
  return {
    vertices: points.map(([x, y]) => ({ x, y })),
    segments: points.map((_, index) => ({
      start: index,
      end: (index + 1) % points.length,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })),
    regions: [{ windingRule: 'NONZERO', loops: [points.map((_, index) => index)] }]
  }
}

describe('vectorChangesFromPagePath', () => {
  test('keeps a gradient where it was on the canvas as the box grows', () => {
    // Recorded in Figma desktop 126 (scratch/pr-oracle/grouping/gradient-drag.ts): dragging the
    // top-right point of a 200 × 120 vector at (40, 60) to (420, 20) gives a 380 × 160 box whose
    // gradient transform turns from the identity to [[1.9, 0, 0], [0, 1.333, -0.333]].
    const editor = createEditor()
    const node = editor.graph.createNode('VECTOR', editor.state.currentPageId, {
      x: 40,
      y: 60,
      width: 200,
      height: 120,
      vectorNetwork: polygon([
        [0, 0],
        [200, 0],
        [200, 120],
        [0, 120]
      ]),
      fills: [
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          gradientTransform: IDENTITY_GRADIENT_TRANSFORM,
          gradientStops: []
        }
      ]
    })

    const changes = vectorChangesFromPagePath(
      editor.graph,
      node,
      polygon([
        [40, 60],
        [420, 20],
        [240, 180],
        [40, 180]
      ])
    )

    expect([changes?.x, changes?.y, changes?.width, changes?.height]).toEqual([40, 20, 380, 160])
    const t = changes?.fills[0]?.gradientTransform
    expect(t?.m00).toBeCloseTo(1.9, 6)
    expect(t?.m02).toBeCloseTo(0, 6)
    expect(t?.m11).toBeCloseTo(4 / 3, 6)
    expect(t?.m12).toBeCloseTo(-1 / 3, 6)
  })
})
