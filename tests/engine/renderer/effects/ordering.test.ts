import { describe, test, expect } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import type { SceneNode, SceneGraph } from '#core/scene-graph'

import {
  createMockRenderer,
  createMockCanvas,
  renderEffects,
  renderShapeUncached,
  renderNode
} from './helpers'
import type { EffectTestGraph } from './helpers'

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Renderer effect ordering (Behavioral)', () => {
  test('drop shadow renders before fills', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'node1',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      fills: [{ visible: true, type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }],
      strokes: [],
      strokeGeometry: []
    }
    const graph: EffectTestGraph = {
      getNode: (_id: string) => node as SceneNode,
      images: new Map()
    }

    const callOrder: string[] = []
    r.renderEffects = (..._args: unknown[]) => {
      const pass = _args[4] as string
      callOrder.push(`renderEffects:${pass}`)
    }
    r.drawNodeFill = (..._args: unknown[]) => {
      callOrder.push('drawNodeFill')
    }

    renderShapeUncached(r, canvas as Canvas, node as SceneNode, graph as SceneGraph)

    expect(callOrder).toEqual(['renderEffects:behind', 'drawNodeFill', 'renderEffects:front'])
  })

  test('inner shadow and blur render after strokes', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node: Partial<SceneNode> = {
      id: 'node1',
      type: 'RECTANGLE',
      width: 100,
      height: 100,
      fills: [],
      fillGeometry: [],
      childIds: [],
      effects: [
        {
          type: 'INNER_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 0, y: 0 },
          radius: 10,
          spread: 0
        }
      ],
      strokes: [{ visible: true, weight: 1, opacity: 1 }],
      strokeGeometry: []
    }
    const graph: EffectTestGraph = {
      getNode: (_id: string) => node as SceneNode,
      images: new Map()
    }

    const callOrder: string[] = []
    r.renderEffects = (..._args: unknown[]) => {
      const pass = _args[4] as string
      callOrder.push(`renderEffects:${pass}`)
    }
    r.drawStrokeWithAlign = (..._args: unknown[]) => {
      callOrder.push('drawStrokeWithAlign')
    }

    renderShapeUncached(r, canvas as Canvas, node as SceneNode, graph as SceneGraph)

    // Strokes are rendered between behind and front effects
    const strokeIdx = callOrder.indexOf('drawStrokeWithAlign')
    const frontIdx = callOrder.indexOf('renderEffects:front')
    expect(strokeIdx).toBeGreaterThan(-1)
    expect(frontIdx).toBeGreaterThan(-1)
    expect(strokeIdx).toBeLessThan(frontIdx)
  })
})

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
    expect((canvas as Canvas).drawRect).toHaveBeenCalled()
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
    expect((canvas as Canvas).drawPath).toHaveBeenCalled()
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
    const graph: EffectTestGraph = {
      getNode: (_id: string) => node as SceneNode,
      images: new Map()
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    const blurMock = r.getCachedBlur as Mock
    expect(blurMock).toHaveBeenCalledWith(5)
    expect((canvas as Canvas).saveLayer).toHaveBeenCalled()
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
    const graph: EffectTestGraph = {
      getNode: (_id: string) => node as SceneNode,
      images: new Map()
    }
    renderNode(r, canvas as Canvas, graph as SceneGraph, 'n1', {})
    const blurMock = r.getCachedBlur as Mock
    expect(blurMock).toHaveBeenCalledWith(10)
    expect((canvas as Canvas).saveLayer).toHaveBeenCalled()
  })
})

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

    expect((canvas as Canvas).drawRect).toHaveBeenCalled()
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

    expect(r.makeRRectWithSpread).toHaveBeenCalledWith(node as SceneNode, 4)
    expect((canvas as Canvas).drawRRect).toHaveBeenCalled()
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
    expect((canvas as Canvas).drawPath).toHaveBeenCalled()
  })
})
