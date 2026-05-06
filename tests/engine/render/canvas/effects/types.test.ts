import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderNode } from '#core/canvas/scene'
import { renderEffects } from '#core/canvas/shadows'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

describe('Renderer handles all effect types (Behavioral)', () => {
  test('handles DROP_SHADOW', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      childIds: [],
      strokeGeometry: [],
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
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(canvas.drawRect).toHaveBeenCalled()
  })

  test('handles INNER_SHADOW', () => {
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
    expect(canvas.drawPath).toHaveBeenCalled()
  })

  test('handles BACKGROUND_BLUR', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      fills: [],
      childIds: [],
      effects: [{ type: 'BACKGROUND_BLUR', visible: true, radius: 10 }]
    }
    renderEffects(r, canvas as Canvas, node as SceneNode, new Float32Array(4), false, 'behind')
    expect(r.applyClippedBlur).toHaveBeenCalled()
  })

  test('handles LAYER_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'LAYER_BLUR', visible: true, radius: 10 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(5)
    expect(canvas.saveLayer).toHaveBeenCalled()
  })

  test('handles FOREGROUND_BLUR in renderNode', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'n1',
      visible: true,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      effects: [{ type: 'FOREGROUND_BLUR', visible: true, radius: 20 }],
      childIds: []
    }
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    expect(r.getCachedBlur).toHaveBeenCalledWith(10)
    expect(canvas.saveLayer).toHaveBeenCalled()
  })
})
