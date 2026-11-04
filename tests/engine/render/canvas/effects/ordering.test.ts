import { describe, expect, mock, test } from 'bun:test'

import type { SceneGraph } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { renderShapeUncached } from '#core/canvas/scene'

import { asCanvas } from '../helpers'
import { createMockCanvas, createMockRenderer } from './helpers'

describe('Renderer effect ordering (Behavioral)', () => {
  test('drop shadow renders before fills', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = createDefaultNode(() => 'node1', 'RECTANGLE', {
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
      strokes: []
    })
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _g, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawNodeFill = mock(() => {
      callOrder.push('drawNodeFill')
    })

    renderShapeUncached(r, asCanvas(canvas), node, graph as SceneGraph)

    expect(callOrder).toEqual([
      'renderEffects:behind',
      'drawNodeFill',
      'renderEffects:inner',
      'renderEffects:front'
    ])
  })

  test('inner shadows render under strokes and noise over them, as in Figma', () => {
    const r = createMockRenderer()
    const canvas = createMockCanvas()
    const node = createDefaultNode(() => 'node1', 'RECTANGLE', {
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
      strokes: [
        {
          type: 'SOLID',
          visible: true,
          weight: 1,
          opacity: 1,
          color: { r: 0, g: 0, b: 0, a: 1 },
          align: 'CENTER'
        }
      ]
    })
    const graph: Partial<SceneGraph> = {
      getNode: mock(() => node)
    }

    const callOrder: string[] = []
    r.renderEffects = mock((_c, _n, _g, pass) => {
      callOrder.push(`renderEffects:${pass}`)
    })
    r.drawStrokeWithAlign = mock(() => {
      callOrder.push('drawStrokeWithAlign')
    })

    renderShapeUncached(r, asCanvas(canvas), node, graph as SceneGraph)

    expect(callOrder).toEqual([
      'renderEffects:behind',
      'renderEffects:inner',
      'drawStrokeWithAlign',
      'renderEffects:front'
    ])
  })
})
