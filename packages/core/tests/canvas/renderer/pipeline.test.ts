import { expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()

test('a frame whose scene draw throws closes the saves it opened on the screen canvas', () => {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(40, 40), 'surface'))
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { width: 20, height: 20 })
  renderer.pageId = page.id
  renderer.viewportWidth = 40
  renderer.viewportHeight = 40
  const shapes = spyOn(renderer, 'renderShape').mockImplementation(() => {
    throw new Error('draw failed')
  })
  const canvas = renderer.surface.getCanvas()
  const entrySaves = canvas.getSaveCount()
  try {
    expect(() => renderer.render(graph, new Set(), {}, 1)).toThrow('draw failed')
    expect(canvas.getSaveCount()).toBe(entrySaves)
  } finally {
    shapes.mockRestore()
    renderer.destroy()
  }
})
