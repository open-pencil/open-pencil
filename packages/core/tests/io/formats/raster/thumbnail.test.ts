import { expect, setDefaultTimeout, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  createCanvasKitRasterCodec,
  headlessRenderThumbnail,
  initCanvasKit,
  thumbnailFrame
} from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

setDefaultTimeout(60_000)

test('a thumbnail shows the page background between its layers', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  for (const x of [0, 90]) {
    graph.createNode('RECTANGLE', page.id, { x, y: 0, width: 10, height: 100 })
  }
  // Figma's dark-theme page background, #1E1E1E, which no renderer is set to.
  new FigmaAPI(graph).currentPage.backgrounds = [
    { type: 'SOLID', color: { r: 30 / 255, g: 30 / 255, b: 30 / 255 }, opacity: 1, visible: true }
  ]

  const png = expectDefined(await headlessRenderThumbnail(graph, page.id, 100, 100), 'thumbnail')
  const image = expectDefined(createCanvasKitRasterCodec(await initCanvasKit()).decode(png))
  const gap = (50 * image.width + 50) * 4

  expect([...image.data.subarray(gap, gap + 4)]).toEqual([30, 30, 30, 255])
})

test('a thumbnail loads the faces its text is set in before drawing it', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  // Inter Bold is bundled, so loading it needs no network, but a renderer loads only Regular.
  graph.createNode('TEXT', page.id, {
    width: 200,
    height: 60,
    text: 'Hello',
    fontSize: 48,
    fontWeight: 700
  })

  const png = expectDefined(await headlessRenderThumbnail(graph, page.id, 200, 60), 'thumbnail')
  const image = expectDefined(createCanvasKitRasterCodec(await initCanvasKit()).decode(png))
  const inked = image.data.filter((red, index) => index % 4 === 0 && red < 128).length

  expect(inked).toBeGreaterThan(0)
})

test('a cover thumbnail fills its size and crops the content around its centre', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  graph.createNode('RECTANGLE', page.id, { x: 0, y: 0, width: 1000, height: 1000 })

  const contained = expectDefined(thumbnailFrame(graph, page.id, 160, 90), 'contained frame')
  expect([contained.width, contained.height]).toEqual([90, 90])

  const covered = expectDefined(thumbnailFrame(graph, page.id, 160, 90, 'cover'), 'covered frame')
  expect([covered.width, covered.height, covered.scale]).toEqual([160, 90, 0.16])
  expect(covered.bounds).toEqual({ minX: 0, minY: 218.75, maxX: 1000, maxY: 781.25 })
})
