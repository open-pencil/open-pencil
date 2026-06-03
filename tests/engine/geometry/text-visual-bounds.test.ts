import { describe, expect, test } from 'bun:test'

import { nodeVisualBounds } from '#core/geometry'
import type { SceneNode } from '#core/scene-graph'

describe('text visual bounds', () => {
  test('includes decoration overflow below text nodes', () => {
    const base = {
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
    } as SceneNode

    const normal = nodeVisualBounds(base, () => ({ x: 10, y: 20 }))
    const decorated = nodeVisualBounds(
      { ...base, textDecoration: 'UNDERLINE', textUnderlineOffset: 5, textDecorationThickness: 2 },
      () => ({ x: 10, y: 20 })
    )

    expect(normal.maxY).toBe(43)
    expect(decorated.maxY).toBeGreaterThan(normal.maxY)
  })
})
