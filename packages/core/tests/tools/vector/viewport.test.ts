import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { viewportZoomToFit } from '#core/tools/vector/viewport'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('viewport_zoom_to_fit', () => {
  test.each([
    [4000, 2400],
    [8000, 4800]
  ])('fits a %i × %i selection instead of resetting zoom to 100%', (width, height) => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    if (!page) throw new Error('SceneGraph should create a default page')
    const frame = graph.createNode('FRAME', page.id, {
      x: 40,
      y: 20,
      width,
      height
    })

    const result = viewportZoomToFit.execute(figma, { ids: [frame.id] })

    expect(result).toEqual({
      center: { x: 40 + width / 2, y: 20 + height / 2 },
      bounds: { x: 40, y: 20, width, height }
    })
    expect(figma.viewport.zoom).toBeLessThan(1)
  })
})
