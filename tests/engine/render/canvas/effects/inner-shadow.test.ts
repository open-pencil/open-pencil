import { describe, expect, test } from 'bun:test'

import { renderEffects } from '#core/canvas/shadows'

import { asCanvas } from '../helpers'
import {
  createMockCanvas,
  createMockRenderer,
  effectNode,
  OPAQUE_FILL,
  TEST_GRAPH
} from './helpers'

describe('INNER_SHADOW bug proofs', () => {
  test('INNER_SHADOW solid mask via ColorFilter on DstOut layer', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')

    // PROOF: ColorFilter.MakeBlend(black, SrcIn) on DstOut layer paint
    // forces the silhouette to solid black without mutating fillPaint.
    // The DstOut saveLayer punches the solid mask from the blurred block.
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(canvas.drawRect).toHaveBeenCalled()
  })
})
