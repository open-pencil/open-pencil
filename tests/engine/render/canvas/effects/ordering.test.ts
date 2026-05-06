import { describe, expect, mock, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { renderShapeUncached } from '#core/canvas/scene'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer } from './helpers'

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
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _r, _h, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawNodeFill = mock(() => {
      callOrder.push('drawNodeFill')
    })

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
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node as SceneNode)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _r, _h, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawStrokeWithAlign = mock(() => {
      callOrder.push('drawStrokeWithAlign')
    })

    renderShapeUncached(r, canvas as Canvas, node as SceneNode, graph as SceneGraph)

    // Strokes are rendered between behind and front effects
    const strokeIdx = callOrder.indexOf('drawStrokeWithAlign')
    const frontIdx = callOrder.indexOf('renderEffects:front')
    expect(strokeIdx).toBeGreaterThan(-1)
    expect(frontIdx).toBeGreaterThan(-1)
    expect(strokeIdx).toBeLessThan(frontIdx)
  })
})
