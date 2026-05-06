import { describe, expect, mock, test } from 'bun:test'

import type { Canvas, Path } from 'canvaskit-wasm'

import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer, mockCalls } from './helpers'

describe('Edge cases and bug fixes', () => {
  test('drop shadow cast from stroke when node has no fill', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
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
      strokes: [{ visible: true, weight: 2, opacity: 1 }],
      strokeGeometry: [{} as Path]
    }
    r.getStrokeGeometry = mock(() => [{} as Path])

    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')

    expect(r.getStrokeGeometry).toHaveBeenCalledWith(node)
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('drop shadow from child applies child transforms (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    // Verify order: translate (offset) -> rotate -> translate (flip) -> scale
    const translateCalls = mockCalls(canvas.translate)
    const rotateCalls = mockCalls(canvas.rotate)
    const scaleCalls = mockCalls(canvas.scale)

    expect(translateCalls[0]).toEqual([5 + 10, 5 + 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child renders glyphs (fidelity parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    expect(r.getCachedDropShadow).toHaveBeenCalled()
    expect(canvas.saveLayer).toHaveBeenCalled()
    expect(canvas.translate).toHaveBeenCalledWith(15, 25)
    expect(r.renderText).toHaveBeenCalledWith(expect.anything(), child)
  })

  test('inner shadow from shape child applies child transforms and rects (geometric parity)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'RECTANGLE',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      rotation: 45,
      flipY: true,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 0,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'front',
      child as SceneNode
    )

    const translateCalls = mockCalls(canvas.translate)
    const rotateCalls = mockCalls(canvas.rotate)
    const scaleCalls = mockCalls(canvas.scale)

    expect(translateCalls[0]).toEqual([10, 20])
    expect(rotateCalls[0]).toEqual([45, 25, 30])
    expect(translateCalls[1]).toEqual([0, 60])
    expect(scaleCalls[0]).toEqual([1, -1])
    expect(r.ck.LTRBRect).toHaveBeenCalledWith(0, 0, 50, 60)
    expect(canvas.clipRect).toHaveBeenCalled()
  })

  test('drop shadow from TEXT child applies offset in parent space', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const child: Partial<SceneNode> = {
      type: 'TEXT',
      x: 10,
      y: 20,
      width: 50,
      height: 60,
      text: 'Hello',
      rotation: 45,
      effects: []
    }
    const node: Partial<SceneNode> = {
      type: 'FRAME',
      width: 100,
      height: 100,
      fills: [],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 0
        }
      ],
      childIds: ['child1']
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array(4),
      false,
      'behind',
      child as SceneNode
    )

    const translateCalls = mockCalls(canvas.translate)
    expect(translateCalls[0]).toEqual([15, 25]) // offset + child position

    // The filter should NOT have the offset (neutralized to 0,0)
    expect(r.getCachedDropShadow).toHaveBeenCalledWith(0, 0, 5, expect.anything())
  })

  test('INNER_SHADOW with large offset does not vanish (bounding box union)', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
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
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      false,
      'front'
    )

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

  test('INNER_SHADOW with spread on rounded rect shrinks hole concentrically', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      cornerRadius: 10,
      fills: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ]
    }

    renderEffects(
      r,
      canvas as Canvas,
      node as SceneNode,
      new Float32Array([0, 0, 100, 100]),
      true,
      'front'
    )

    // makeRRectWithOffset should receive (node, localOffsetX, localOffsetY, spread)
    // localOffsetX = 5, localOffsetY = 5, spread = 4
    expect(r.makeRRectWithOffset).toHaveBeenCalledWith(node, 5, 5, 4)
  })
})
