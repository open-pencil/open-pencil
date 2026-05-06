import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderEffects } from '#core/canvas/shadows'
import type { SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

describe('Shadow spread support (Behavioral)', () => {
  test('drop shadow uses spread for shape expansion', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ],
      strokeGeometry: []
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'behind')

    expect(canvas.drawRect).toHaveBeenCalled()
    expect(r.ltrb).toHaveBeenCalledWith(-4, -4, 104, 104)
  })

  test('drop shadow uses makeRRectWithSpread when node has radius', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 5, y: 5 },
          radius: 10,
          spread: 4
        }
      ],
      strokeGeometry: []
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, true, 'behind')

    expect(r.makeRRectWithSpread).toHaveBeenCalledWith(node, 4)
    expect(canvas.drawRRect).toHaveBeenCalled()
  })

  test('inner shadow uses spread for cutout contraction', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
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
          spread: 4
        }
      ]
    }
    const rect = new Float32Array([0, 0, 100, 100])

    renderEffects(r, canvas as Canvas, node as SceneNode, rect, false, 'front')

    expect(r.ck.LTRBRect).toHaveBeenCalledWith(9, 9, 101, 101)
    expect(canvas.drawPath).toHaveBeenCalled()
  })
})
