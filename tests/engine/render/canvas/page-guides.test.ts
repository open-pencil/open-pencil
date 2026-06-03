import { describe, expect, test } from 'bun:test'

import type { Canvas } from 'canvaskit-wasm'

import { drawPageGuides } from '#core/canvas/page-guides'
import type { SceneGraph, SceneNode } from '#core/scene-graph'

import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

function graphWithGuides(guides: unknown[]): SceneGraph {
  const page = {
    id: 'page',
    source: { fig: { rawNodeFields: { guides } } }
  } as SceneNode
  return {
    rootId: 'root',
    getNode: (id: string) => (id === 'page' ? page : null)
  } as SceneGraph
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
      { axis: 'X', offset: 42 },
      { axis: 'Y', offset: 84 }
    ])

    drawPageGuides(r, canvas as Canvas, graph)

    expect(mockCalls(canvas.drawRect)).toHaveLength(2)
    expect(mockCalls(r.ck.LTRBRect)).toEqual([
      [94, 0, 95, 200],
      [0, 188, 300, 189]
    ])
  })

  test('ignores malformed guides', () => {
    const r = createMockRenderer({ pageId: 'page' })
    const canvas = createMockCanvas()
    const graph = graphWithGuides([{ axis: 'X' }, { axis: 'Z', offset: 10 }])

    drawPageGuides(r, canvas as Canvas, graph)

    expect(canvas.drawRect).not.toHaveBeenCalled()
  })
})
