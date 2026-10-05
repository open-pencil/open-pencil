import { describe, expect, mock, test } from 'bun:test'

import { createDefaultNode, SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { drawGuides } from '#core/canvas/guides/draw'

import { createMockCanvas, createMockRenderer, mockCalls } from '../effects/helpers'
import { asCanvas, asDouble } from '../helpers'

function graphWithGuides(guides: SceneNode['guides']): SceneGraph {
  const page = createDefaultNode(() => 'page', 'CANVAS', { childIds: [], guides })
  return asDouble<SceneGraph>({
    rootId: 'root',
    getNode: (id: string) => (id === 'page' ? page : null)
  })
}

describe('page guide rendering', () => {
  test('renders imported Figma page guides in screen space', () => {
    const r = createMockRenderer({
      pageId: 'page',
      panX: 10,
      panY: 20,
      zoom: 2,
      viewportWidth: 300,
      viewportHeight: 200
    })
    const canvas = createMockCanvas()
    const graph = graphWithGuides([
      { id: 'x', axis: 'x', position: 42 },
      { id: 'y', axis: 'y', position: 84 }
    ])

    drawGuides(r, asCanvas(canvas), graph, undefined)

    expect(mockCalls(canvas.drawRect)).toHaveLength(2)
    expect(mockCalls(r.ck.LTRBRect)).toEqual([
      [94, 0, 95, 200],
      [0, 188, 300, 189]
    ])
  })

  test('renders nested frame guides', () => {
    const r = createMockRenderer({ pageId: 'page', zoom: 1, panX: 0, panY: 0 })
    const canvas = { ...createMockCanvas(), drawLine: mock(() => undefined) }
    const nested = createDefaultNode(() => 'nested', 'FRAME', {
      parentId: 'frame',
      childIds: [],
      x: 20,
      y: 30,
      width: 100,
      height: 80,
      rotation: 0,
      flipX: false,
      flipY: false,
      guides: [{ id: 'nested-guide', axis: 'x', position: 10 }]
    })
    const frame: SceneNode = {
      ...nested,
      id: 'frame',
      parentId: 'page',
      childIds: ['nested'],
      x: 100,
      y: 100,
      guides: []
    }
    const page = createDefaultNode(() => 'page', 'CANVAS', {
      parentId: null,
      childIds: ['frame'],
      guides: []
    })
    const nodes = new Map([
      ['page', page],
      ['frame', frame],
      ['nested', nested]
    ])
    const graph = new SceneGraph()
    graph.rootId = 'root'
    graph.nodes = nodes

    drawGuides(r, asCanvas(canvas), graph, undefined)

    expect(canvas.drawLine).toHaveBeenCalled()
  })

  test('ignores pages without guides', () => {
    const r = createMockRenderer({ pageId: 'page' })
    const canvas = createMockCanvas()
    const graph = graphWithGuides([])

    drawGuides(r, asCanvas(canvas), graph, undefined)

    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
