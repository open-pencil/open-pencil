import { describe, expect, test } from 'bun:test'

import { renderEffects } from '#core/canvas/shadows'

import { asCanvas } from '../helpers'
import {
  createMockCanvas,
  createMockRenderer,
  effectNode,
  mockCalls,
  OPAQUE_FILL,
  TEST_GRAPH
} from './helpers'

describe('Text shadows follow the glyphs, not the bounding box (Behavioral)', () => {
  test('drop shadow is cast from the glyph silhouette', () => {
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
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalledWith(expect.anything(), expect.any(Float32Array))
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(-20, -20, 125, 125)
    expect(r.paintShapeContent).toHaveBeenCalledTimes(1)
  })

  test('inner shadow is cut from the glyph silhouette', () => {
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
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')

    // 4-layer saveLayer stack: Master, SrcIn/Tint, Blur, DstOut/Punch
    expect(canvas.saveLayer).toHaveBeenCalledTimes(4)
    for (const call of canvas.saveLayer.mock.calls) {
      expect(call[1]).toBeInstanceOf(Float32Array)
    }
    // The glyph silhouette is drawn twice: once for the mask, once for the punch-out
    expect(r.paintShapeContent).toHaveBeenCalledTimes(2)
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
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')

    const calls = mockCalls(r.effectLayerPaint.setColorFilter)
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
