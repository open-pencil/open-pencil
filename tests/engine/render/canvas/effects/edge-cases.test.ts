import { describe, expect, mock, test } from 'bun:test'

import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

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

describe('Edge cases and bug fixes', () => {
  test('a dashed stroke without a fill casts from an opaque copy of its dashes', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: false, type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokes: [
        {
          type: 'SOLID',
          visible: true,
          weight: 2,
          opacity: 1,
          color: { r: 0, g: 0, b: 0, a: 1 },
          align: 'CENTER',
          dashPattern: [4, 2]
        }
      ],
      strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array() }],
      childIds: []
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(r.paintShapeContent).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        fills: [],
        strokes: [expect.objectContaining({ dashPattern: [4, 2], opacity: 1 })],
        effects: []
      }),
      TEST_GRAPH
    )
  })

  test('drop shadow is not drawn under a fill at 0% opacity', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = createDefaultNode(() => 'transparent-fill', 'RECTANGLE', {
      width: 200,
      height: 200,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 8,
          spread: 0,
          showShadowBehindNode: false
        }
      ],
      strokes: [],
      strokeGeometry: [],
      childIds: []
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')

    expect(canvas.drawRect).not.toHaveBeenCalled()
    expect(canvas.drawPath).not.toHaveBeenCalled()
  })

  test('INNER_SHADOW with large offset does not vanish (bounding box union)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 200, y: 0 },
          radius: 10,
          spread: 0
        }
      ]
    })

    renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')

    // Expect LTRBRect for 'big' to encompass both the shape (0 to 100) and the offset hole (200 to 300)
    // with expand (20) padding: min(-20, -20+200) = -20, max(100+20, 100+20+200) = 320
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(
      -20, // min(-expand, -expand + offsetX)
      -20, // min(-expand, -expand + offsetY)
      320, // max(width + expand, width + expand + offsetX)
      120 // max(height + expand, height + expand + offsetY)
    )
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('drop shadow restores canvas and paint state when drawing throws', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    canvas.drawRect = mock(() => {
      throw new Error('draw failed')
    })
    const node = effectNode({
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokeGeometry: [],
      childIds: []
    })

    expect(() => renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'behind')).toThrow(
      'draw failed'
    )

    expect(canvas.restore).toHaveBeenCalled()
    expect(r.auxFill.setMaskFilter).toHaveBeenCalledWith(null)
    expect(r.auxFill.setBlendMode).toHaveBeenCalledWith(r.ck.BlendMode.SrcOver)
  })

  test('text inner shadow restores canvas when glyph rendering throws', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    r.paintShapeContent = mock(() => {
      throw new Error('text failed')
    })
    const node = effectNode({
      type: 'TEXT',
      width: 100,
      height: 100,
      fills: [OPAQUE_FILL],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ]
    })

    expect(() => renderEffects(r, asCanvas(canvas), node, TEST_GRAPH, 'inner')).toThrow(
      'text failed'
    )

    expect(mockCalls(canvas.restore).length).toBe(1)
    expect(r.effectLayerPaint.setColorFilter).toHaveBeenCalledWith(null)
    expect(r.effectLayerPaint.setImageFilter).toHaveBeenCalledWith(null)
  })
})
