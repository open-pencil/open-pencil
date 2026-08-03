import { describe, expect, test } from 'bun:test'

import { writeStoredPageColor } from '@open-pencil/fig'
import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { CANVAS_BG_COLOR } from '#core/constants'
import { headlessRenderThumbnail } from '#core/io/formats/raster'

const THUMBNAIL_WIDTH = 40
const THUMBNAIL_HEIGHT = 30

// #7884DE — the stage colour from the workspace thumbnail bug report.
const STORED_STAGE = { r: 0x78 / 255, g: 0x84 / 255, b: 0xde / 255, a: 1 }

function createGraphWithContent(): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.createNode('RECTANGLE', pageId, { x: 0, y: 0, width: 80, height: 40 })
  return { graph, pageId }
}

async function cornerPixel(png: Uint8Array): Promise<[number, number, number, number]> {
  const ck = await initCanvasKit()
  const image = ck.MakeImageFromEncoded(png)
  if (!image) throw new Error('Thumbnail PNG did not decode')
  const surface = ck.MakeSurface(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  try {
    const canvas = surface.getCanvas()
    canvas.drawImage(image, 0, 0)
    const pixels = canvas.readPixels(0, 0, {
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB,
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT
    })
    if (!(pixels instanceof Uint8Array) || pixels.length < 4) {
      throw new Error('Could not read thumbnail pixels')
    }
    return [pixels[0], pixels[1], pixels[2], pixels[3]]
  } finally {
    surface.delete()
    image.delete()
  }
}

function expectChannel(value: number, expected: number): void {
  expect(Math.abs(value - expected)).toBeLessThanOrEqual(2)
}

describe('headless thumbnail stage colour', () => {
  test('renders the stored page colour as the stage', async () => {
    const { graph, pageId } = createGraphWithContent()
    writeStoredPageColor(graph, pageId, STORED_STAGE)

    const png = await headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    if (!png) throw new Error('Thumbnail render returned null')

    const [r, g, b, a] = await cornerPixel(png)
    expectChannel(r, 0x78)
    expectChannel(g, 0x84)
    expectChannel(b, 0xde)
    expect(a).toBe(255)
  })

  test('a colourless document resets the shared renderer back to the default stage', async () => {
    // Warm the cached renderer with a coloured document first: it is reused
    // across renders, so a colourless one must not inherit the previous stage.
    const coloured = createGraphWithContent()
    writeStoredPageColor(coloured.graph, coloured.pageId, STORED_STAGE)
    await headlessRenderThumbnail(
      coloured.graph,
      coloured.pageId,
      THUMBNAIL_WIDTH,
      THUMBNAIL_HEIGHT
    )

    const { graph, pageId } = createGraphWithContent()
    const png = await headlessRenderThumbnail(graph, pageId, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    if (!png) throw new Error('Thumbnail render returned null')

    const [r, g, b] = await cornerPixel(png)
    const defaultChannel = Math.round(CANVAS_BG_COLOR.r * 255)
    expectChannel(r, defaultChannel)
    expectChannel(g, defaultChannel)
    expectChannel(b, defaultChannel)
  })
})
