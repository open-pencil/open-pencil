import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Figma's plugin API takes a page background as a paint with an RGB colour and optional opacity
// and visibility, as for fills.
describe('page backgrounds in the plugin API', () => {
  test('a background takes an RGB colour without alpha', () => {
    const figma = new FigmaAPI(new SceneGraph())
    figma.currentPage.backgrounds = [
      { type: 'SOLID', color: { r: 30 / 255, g: 30 / 255, b: 30 / 255 } }
    ]
    expect(figma.currentPage.backgrounds).toEqual([
      expect.objectContaining({
        type: 'SOLID',
        opacity: 1,
        visible: true,
        color: {
          r: expect.closeTo(30 / 255, 6),
          g: expect.closeTo(30 / 255, 6),
          b: expect.closeTo(30 / 255, 6)
        }
      })
    ])
  })

  test('page backgrounds expose imported canvas paints and support assignment', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const page = graph.getNode(api.currentPage.id)
    expect(page).toBeDefined()
    if (!page) return
    page.source.fig.rawNodeFields.backgroundPaints = [
      {
        type: 'SOLID',
        color: { r: 0.5, g: 0.75, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    expect(api.currentPage.backgrounds).toEqual([
      {
        type: 'SOLID',
        color: { r: 0.5, g: 0.75, b: 1 },
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL',
        boundVariables: {}
      }
    ])

    api.currentPage.backgrounds = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0 },
        opacity: 0.5,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
    expect(api.currentPage.backgrounds[0]).toMatchObject({
      color: { r: 1, g: 0, b: 0 },
      opacity: 0.5
    })
    expect(page.source.fig.rawNodeFields.backgroundColor).toEqual({ r: 1, g: 0, b: 0, a: 1 })
  })
})
