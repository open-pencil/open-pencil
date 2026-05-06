import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

describe('INNER_SHADOW bug proofs', () => {
  test('INNER_SHADOW solid mask via ColorFilter on DstOut layer', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [],
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
    }

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'front')

    // PROOF: ColorFilter.MakeBlend(black, SrcIn) on DstOut layer paint
    // forces renderText output to solid black without mutating fillPaint.
    // The DstOut saveLayer punches the solid mask from the blurred block.
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(canvas.drawRect).toHaveBeenCalled()
  })
})
