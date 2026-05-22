/**
 * Tests for renderBooleanOperation image-shader nested try/finally safety
 * and renderComponentSet dash-effect nested try/finally safety.
 */

import { describe, expect, mock, test } from 'bun:test'

import { renderBooleanOperation } from '#core/canvas/boolean'
import { renderComponentSet } from '#core/canvas/scene'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockGraph, createMockRenderer } from './helpers'

// ─── renderBooleanOperation ───────────────────────────────────

describe('renderBooleanOperation: image shader nested try/finally safety', () => {
  function makePath() {
    return { delete: mock(() => undefined), transform: mock(() => undefined) } as never
  }

  function makeShader() {
    return { delete: mock(() => undefined) }
  }

  function makeBooleanNode(overrides: Partial<SceneNode> = {}): SceneNode {
    return {
      id: 'bool-node',
      type: 'BOOLEAN_OPERATION',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
      locked: false,
      opacity: 1,
      booleanOperation: 'UNION',
      fills: [],
      strokes: [],
      effects: [],
      childIds: ['child-1'],
      rotation: 0,
      flipX: false,
      flipY: false,
      ...overrides
    } as SceneNode
  }

  function makeGraphWithChild(): SceneGraph {
    const childNode = {
      id: 'child-1',
      type: 'RECTANGLE',
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 1, g: 0, b: 0, a: 1 } }],
      strokes: [],
      effects: [],
      childIds: [],
      rotation: 0,
      flipX: false,
      flipY: false,
      cornerRadius: 0
    } as SceneNode

    const graph = createMockGraph()
    graph.getNode = mock(() => childNode) as never
    return graph as SceneGraph
  }

  function setupRenderer(overrides: Record<string, unknown> = {}) {
    const renderer = createMockRenderer({
      applyFill: mock(() => true),
      ...overrides
    })
    renderer.ck.Path = class {
      moveTo = mock(() => undefined)
      lineTo = mock(() => undefined)
      close = mock(() => undefined)
      delete = mock(() => undefined)
      addPath = mock(() => undefined)
      op = mock(() => true)
      transform = mock(() => undefined)
      stroke = mock(() => ({ delete: mock(() => undefined) }))
    } as never
    renderer.ck.Matrix = {
      ...renderer.ck.Matrix,
      translated: mock(() => new Float32Array(9)),
      rotated: mock(() => new Float32Array(9)),
      scaled: mock(() => new Float32Array(9)),
      multiply: mock(() => new Float32Array(9))
    } as never

    const boolPath = makePath()
    renderer.makeNodeShapePath = mock(() => boolPath) as never
    return { renderer, boolPath }
  }

  test('image shader is deleted after normal draw', () => {
    const shader = makeShader()
    const { renderer } = setupRenderer({ imageFillShader: shader })
    const canvas = createMockCanvas()
    const graph = makeGraphWithChild()
    const node = makeBooleanNode({
      fills: [{ type: 'IMAGE', visible: true, opacity: 1, imageHash: 'h', imageScaleMode: 'FILL' }]
    })

    renderBooleanOperation(renderer as never, canvas as never, node, graph)

    expect(renderer.fillPaint.setShader).toHaveBeenCalledWith(null)
    expect(shader.delete).toHaveBeenCalled()
  })

  test('image shader is deleted even when drawPath throws', () => {
    const shader = makeShader()
    const { renderer } = setupRenderer({ imageFillShader: shader })
    const canvas = createMockCanvas({
      drawPath: () => {
        throw new Error('drawPath crash')
      }
    })
    const graph = makeGraphWithChild()
    const node = makeBooleanNode({
      fills: [{ type: 'IMAGE', visible: true, opacity: 1, imageHash: 'h', imageScaleMode: 'FILL' }]
    })

    expect(() => {
      renderBooleanOperation(renderer as never, canvas as never, node, graph)
    }).toThrow('drawPath crash')

    expect(shader.delete).toHaveBeenCalled()
    expect(renderer.fillPaint.setShader).toHaveBeenCalledWith(null)
  })

  test('image shader is deleted even when setShader(null) throws', () => {
    const shader = makeShader()
    const { renderer } = setupRenderer({ imageFillShader: shader })
    renderer.fillPaint.setShader = mock((val: unknown) => {
      if (val === null) throw new Error('setShader(null) crash')
    }) as never

    const canvas = createMockCanvas()
    const graph = makeGraphWithChild()
    const node = makeBooleanNode({
      fills: [{ type: 'IMAGE', visible: true, opacity: 1, imageHash: 'h', imageScaleMode: 'FILL' }]
    })

    expect(() => {
      renderBooleanOperation(renderer as never, canvas as never, node, graph)
    }).toThrow('setShader(null) crash')

    expect(shader.delete).toHaveBeenCalled()
  })

  test('no image shader: no crash, no delete', () => {
    const { renderer } = setupRenderer({ imageFillShader: null })
    const canvas = createMockCanvas()
    const graph = makeGraphWithChild()
    const node = makeBooleanNode({
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 1, g: 0, b: 0, a: 1 } }]
    })

    renderBooleanOperation(renderer as never, canvas as never, node, graph)
    expect(renderer.fillPaint.setShader).toHaveBeenCalledWith(null)
  })
})

// ─── renderComponentSet ──────────────────────────────────────

describe('renderComponentSet: dash effect nested try/finally safety', () => {
  function makeDashEffect() {
    return { delete: mock(() => undefined) }
  }

  function makeComponentSetNode(overrides: Partial<SceneNode> = {}): SceneNode {
    return {
      id: 'compset-node',
      type: 'COMPONENT_SET',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      visible: true,
      locked: false,
      opacity: 1,
      fills: [],
      strokes: [],
      effects: [],
      childIds: [],
      rotation: 0,
      flipX: false,
      flipY: false,
      cornerRadius: 0,
      ...overrides
    } as SceneNode
  }

  test('dash effect is deleted after normal draw', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      applyFill: mock(() => true)
    })
    const canvas = createMockCanvas()
    const graph = createMockGraph()
    const node = makeComponentSetNode()

    renderComponentSet(renderer as never, canvas as never, node, graph)

    expect(dashEffect.delete).toHaveBeenCalled()
    expect(renderer.auxStroke.setPathEffect).toHaveBeenCalledWith(null)
  })

  test('dash effect is deleted even when drawRRect throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      applyFill: mock(() => true)
    })
    const canvas = createMockCanvas({
      drawRRect: () => {
        throw new Error('drawRRect crash')
      }
    })
    const graph = createMockGraph()
    const node = makeComponentSetNode()

    expect(() => {
      renderComponentSet(renderer as never, canvas as never, node, graph)
    }).toThrow('drawRRect crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })

  test('dash effect is deleted even when setPathEffect(null) throws', () => {
    const dashEffect = makeDashEffect()
    const renderer = createMockRenderer({
      ck: {
        ...createMockRenderer().ck,
        PathEffect: { MakeDash: mock(() => dashEffect) }
      } as never,
      applyFill: mock(() => true)
    })
    renderer.auxStroke.setPathEffect = mock((val: unknown) => {
      if (val === null) throw new Error('setPathEffect(null) crash')
    }) as never

    const canvas = createMockCanvas()
    const graph = createMockGraph()
    const node = makeComponentSetNode()

    expect(() => {
      renderComponentSet(renderer as never, canvas as never, node, graph)
    }).toThrow('setPathEffect(null) crash')

    expect(dashEffect.delete).toHaveBeenCalled()
  })
})
