import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { buildP3BlendCells, P3_BLENDS, P3_CELL } from '#core-tests/helpers/display-p3'

import type { ColorSpace, Image } from '@open-pencil/canvaskit'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type DocumentColorSpace } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { registerTestFont } from '@open-pencil/test-support/fonts/bundled'

import { SkiaRenderer } from '#core/canvas/renderer/skia'
import { renderNodesToImage } from '#core/io/formats/raster/render'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1), 'surface'))
afterAll(() => renderer.destroy())
beforeAll(async () => {
  await registerTestFont('P3 text fixture')
  await renderer.loadFonts()
})

function exported(space: DocumentColorSpace) {
  const graph = new SceneGraph()
  graph.documentColorSpace = space
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, {
    width: P3_BLENDS[0].modes.length * P3_CELL,
    height: P3_BLENDS.length * P3_CELL,
    fills: []
  })
  const cells = buildP3BlendCells(graph, frame.id)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page.id, [frame.id], { scale: 1, format: 'PNG' }),
    'png'
  )
  return { cells, image: expectDefined(ck.MakeImageFromEncoded(png), 'image') }
}

function components(image: Image, x: number, y: number, space: ColorSpace): number[] {
  const pixels = expectDefined(
    image.readPixels(Math.floor(x), Math.floor(y), {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: space
    }),
    'pixels'
  )
  return Array.from(pixels.subarray(0, 3))
}

describe('raster export of a document in a color profile', () => {
  test('a Display P3 document blends in its own components, as Figma exports it', () => {
    const { cells, image } = exported('display-p3')
    try {
      for (const { x, y, expected } of cells) {
        const actual = components(image, x, y, ck.ColorSpace.DISPLAY_P3)
        // Color burn divides, so a level of rounding in what it reads moves it by two.
        expected.forEach((channel, index) =>
          expect(Math.abs(actual[index] - channel)).toBeLessThanOrEqual(2)
        )
      }
    } finally {
      image.delete()
    }
  })

  test('the image carries the document profile', () => {
    // A decoded profile is read back from its ICC data, so a P3 one is P3 but not Skia's object.
    for (const [space, isSRGB] of [
      ['display-p3', false],
      ['srgb', true]
    ] as const) {
      const { image } = exported(space)
      try {
        expect(ck.ColorSpace.Equals(image.getColorSpace(), ck.ColorSpace.SRGB)).toBe(isSRGB)
      } finally {
        image.delete()
      }
    }
  })

  test('an sRGB document keeps its components and blends them', () => {
    const { cells, image } = exported('srgb')
    try {
      const [normal, multiply] = cells
      const { source, backdrop } = P3_BLENDS[0]
      expect(components(image, normal.x, normal.y, ck.ColorSpace.SRGB)).toEqual(
        [source.r, source.g, source.b].map((channel) => Math.round(channel * 255))
      )
      const product = [source.r * backdrop.r, source.g * backdrop.g, source.b * backdrop.b]
      components(image, multiply.x, multiply.y, ck.ColorSpace.SRGB).forEach((channel, index) =>
        expect(Math.abs(channel - product[index] * 255)).toBeLessThanOrEqual(1)
      )
    } finally {
      image.delete()
    }
  })

  test('text keeps a Display P3 color outside sRGB, as a shape of that color does', () => {
    const graph = new SceneGraph()
    graph.documentColorSpace = 'display-p3'
    const page = graph.getPages()[0]
    const red = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const frame = graph.createNode('FRAME', page.id, { width: 200, height: 200, fills: [] })
    graph.createNode('RECTANGLE', frame.id, { width: 20, height: 20, fills: [red] })
    graph.createNode('TEXT', frame.id, {
      x: 40,
      width: 160,
      height: 200,
      text: 'I',
      fontFamily: 'P3 text fixture',
      fontSize: 180,
      fills: [red]
    })
    const png = expectDefined(
      renderNodesToImage(ck, renderer, graph, page.id, [frame.id], { scale: 1, format: 'PNG' }),
      'png'
    )
    const image = expectDefined(ck.MakeImageFromEncoded(png), 'image')
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: 200,
          height: 200,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.DISPLAY_P3
        }),
        'pixels'
      )
      const shape = components(image, 10, 10, ck.ColorSpace.DISPLAY_P3)
      // The text's most saturated covered pixel, inside its stem.
      let glyph = [0, 255, 255]
      for (let i = 0; i < 200 * 200; i++) {
        const [r, g, b, a] = pixels.subarray(i * 4, i * 4 + 4)
        if (i % 200 >= 40 && a === 255 && r - g > glyph[0] - glyph[1]) glyph = [r, g, b]
      }
      expect(shape).toEqual([255, 0, 0])
      expect(glyph).toEqual(shape)
    } finally {
      image.delete()
    }
  })
})
