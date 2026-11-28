import { expect, spyOn, test } from 'bun:test'

import { effect } from '#core-tests/canvas/blur/helpers'

import { SceneGraph, type Effect } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { SkiaRenderer } from '#core/canvas'
import { getCanvasKit } from '#core/canvaskit'

const ck = await getCanvasKit()

function rendererWithFailingRect(effects: Effect[]) {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(40, 40), 'surface'))
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { width: 20, height: 20, effects })
  renderer.pageId = page.id
  renderer.viewportWidth = 40
  renderer.viewportHeight = 40
  const shapes = spyOn(renderer, 'renderShape').mockImplementation(() => {
    throw new Error('draw failed')
  })
  const render = () => renderer.render(graph, new Set(), {}, 1)
  const dispose = () => {
    shapes.mockRestore()
    renderer.destroy()
  }
  return { renderer, render, dispose }
}

test('a frame whose scene draw throws closes the saves it opened on the screen canvas', () => {
  const { renderer, render, dispose } = rendererWithFailingRect([])
  const canvas = renderer.surface.getCanvas()
  const entrySaves = canvas.getSaveCount()
  try {
    expect(render).toThrow('draw failed')
    expect(canvas.getSaveCount()).toBe(entrySaves)
  } finally {
    dispose()
  }
})

test('a layer-blurred node whose draw throws leaves the effect layer paint without a filter', () => {
  const { renderer, render, dispose } = rendererWithFailingRect([effect('LAYER_BLUR', 4)])
  const imageFilters = spyOn(renderer.effectLayerPaint, 'setImageFilter')
  try {
    expect(render).toThrow('draw failed')
    expect(imageFilters).toHaveBeenCalled()
    expect(imageFilters.mock.calls.at(-1)).toEqual([null])
  } finally {
    imageFilters.mockRestore()
    dispose()
  }
})
