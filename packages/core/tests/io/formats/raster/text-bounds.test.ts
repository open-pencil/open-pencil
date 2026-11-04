import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import {
  createCanvasKitRasterCodec,
  headlessRenderNodes,
  initCanvasKit
} from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'

import { fontManager } from '#core/text/font/manager'

beforeAll(async () => {
  await fontManager.markLoaded(
    'Inter',
    'Regular',
    expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'), 'bundled Inter font')
  )
})

type Text = ReturnType<FigmaAPI['createText']>

async function exportedSize(setUp: (text: Text) => void): Promise<number[]> {
  const graph = new SceneGraph()
  const text = new FigmaAPI(graph).createText()
  text.fontSize = 24
  setUp(text)
  const png = expectDefined(
    await headlessRenderNodes(graph, graph.getPages()[0].id, [text.id]),
    'export'
  )
  const image = expectDefined(
    createCanvasKitRasterCodec(await initCanvasKit()).decode(png),
    'image'
  )
  return [image.width, image.height]
}

// Figma desktop 126 (2026-11-05) exports a text at its render bounds: its glyphs' ink, grown by
// strokes and effects. Inter 3.19 there and Inter 4 here differ by up to a pixel in width.
describe('exported text size', () => {
  test('is the ink of its glyphs, not its box', async () => {
    for (const [setUp, figma] of [
      [(text: Text) => (text.characters = 'H'), [14, 18]],
      [(text: Text) => (text.characters = 'Hgy\nHgy'), [43, 52]],
      [
        (text: Text) => {
          text.characters = 'Hgy\nHgy'
          text.lineHeight = { unit: 'PIXELS', value: 0 }
        },
        [43, 23]
      ],
      [
        (text: Text) => {
          text.characters = 'H'
          text.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
          text.strokeWeight = 4
          text.strokeAlign = 'OUTSIDE'
        },
        [22, 26]
      ]
    ] as const) {
      const [width, height] = await exportedSize(setUp)
      expect(Math.abs(width - figma[0])).toBeLessThanOrEqual(1)
      expect(height).toBe(figma[1])
    }
  })
})
