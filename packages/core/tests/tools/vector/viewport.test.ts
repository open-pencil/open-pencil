import { describe, expect, test } from 'bun:test'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { viewportZoomToFit } from '#core/tools/vector/viewport'

type ViewportZoomToFitResult = {
  center: Vector
  bounds: Rect
}

const fitNodes = (figma: FigmaAPI, ids: string[]): ViewportZoomToFitResult =>
  viewportZoomToFit.execute(figma, { ids }) as ViewportZoomToFitResult

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

    const result = fitNodes(figma, [frame.id])

    expect(result).toEqual({
      center: { x: 40 + width / 2, y: 20 + height / 2 },
      bounds: { x: 40, y: 20, width, height }
    })
    const viewport = figma.viewport
    expect(width * viewport.zoom).toBeLessThanOrEqual(1280)
    expect(height * viewport.zoom).toBeLessThanOrEqual(720)
    expect(viewport.center).toEqual(result.center)
  })

  test('fits the measured renderer viewport', () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const page = graph.getPages()[0]
    if (!page) throw new Error('SceneGraph should create a default page')
    const viewportSize = { width: 640, height: 400 }
    const renderer: Partial<SkiaRenderer> = {
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height
    }
    figma.setRenderer(renderer as SkiaRenderer)
    const frame = graph.createNode('FRAME', page.id, {
      x: 40,
      y: 20,
      width: 8000,
      height: 4800
    })

    const result = fitNodes(figma, [frame.id])
    const viewport = figma.viewport

    expect(8000 * viewport.zoom).toBeLessThanOrEqual(viewportSize.width)
    expect(4800 * viewport.zoom).toBeLessThanOrEqual(viewportSize.height)
    expect(viewport.center).toEqual(result.center)
  })
})
