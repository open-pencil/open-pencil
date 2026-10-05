import { describe, expect, test } from 'bun:test'

import type { VisualBoundsNode } from '@open-pencil/scene-graph/geometry'
import { nodeVisualBounds } from '@open-pencil/scene-graph/geometry'

describe('text visual bounds', () => {
  test('includes decoration overflow below text nodes', () => {
    const base: VisualBoundsNode = {
      id: 'text',
      type: 'TEXT',
      visible: true,
      width: 100,
      height: 23,
      rotation: 0,
      flipX: false,
      flipY: false,
      strokes: [],
      effects: [],
      fillGeometry: [],
      strokeGeometry: [],
      childIds: [],
      fontSize: 32,
      textDecoration: 'NONE',
      textUnderlineOffset: null,
      textDecorationThickness: null
    }

    const normal = nodeVisualBounds(base, () => ({ x: 10, y: 20 }))
    const decorated = nodeVisualBounds(
      { ...base, textDecoration: 'UNDERLINE', textUnderlineOffset: 5, textDecorationThickness: 2 },
      () => ({ x: 10, y: 20 })
    )

    expect(normal.maxY).toBe(43)
    expect(decorated.maxY).toBeGreaterThan(normal.maxY)
  })
})
