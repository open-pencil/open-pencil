import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

describe('Text shadow renders on glyphs, not bounding box (Behavioral)', () => {
  test('drop shadow has TEXT-specific branch', () => {
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
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'behind')

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(r.renderText).toHaveBeenCalled()
  })

  test('inner shadow has TEXT-specific branch', () => {
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
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    // 4-layer saveLayer stack: Master, SrcIn/Tint, Blur, DstOut/Punch
    expect(canvas.saveLayer).toHaveBeenCalledTimes(4)
    // renderText called twice: once for mask (step 2), once for punch-out (step 8)
    expect(r.renderText).toHaveBeenCalledTimes(2)
    // Blend modes for the SrcIn and DstOut layers
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.SrcIn)
    expect(r.effectLayerPaint.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.DstOut)
    // Blur filter for the shadow
    expect(r.getCachedDecalBlur).toHaveBeenCalledTimes(1)
    // Giant rect for (1-M) base
    expect(canvas.drawRect).toHaveBeenCalledTimes(1)
  })

  test('inner shadow detaches ColorFilter from effectLayerPaint before deletion', () => {
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
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    const calls = r.effectLayerPaint.setColorFilter.mock.calls
    // The final call must be null (exit guard cleans up)
    const lastCall = calls[calls.length - 1]
    expect(lastCall[0]).toBeNull()

    // Every non-null ColorFilter assignment must have a subsequent null detach.
    // This verifies the detach-before-delete pattern for both tintFilter and solidBlackFilter.
    for (let i = 0; i < calls.length; i++) {
      if (calls[i][0] !== null) {
        const hasSubsequentNull = calls.slice(i + 1).some((c) => c[0] === null)
        expect(hasSubsequentNull).toBe(true)
      }
    }
  })
})
