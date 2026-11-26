import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { renderNodesToSVG } from '@open-pencil/core/io/formats/svg'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import { svgDataURL } from '@open-pencil/scene-graph/images'
import { repoPath } from '@open-pencil/test-support/paths'

type RGB = [number, number, number]
type Point = [number, number]

const SIZE = 40
const WEIGHT = 8
const IMAGE_HASH = 'svg-stroke-paint-image'

const WHITE: Fill = { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }

const RED_TO_BLUE: Stroke = {
  type: 'GRADIENT_LINEAR',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight: WEIGHT,
  align: 'CENTER',
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
  ],
  gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
}

const GREEN_IMAGE: Stroke = {
  ...RED_TO_BLUE,
  type: 'IMAGE',
  gradientStops: undefined,
  gradientTransform: undefined,
  imageHash: IMAGE_HASH,
  imageScaleMode: 'FILL'
}

/** Where a stroke's band is, from the outline, for each alignment. */
const BAND_MIDDLE = { CENTER: 0, INSIDE: WEIGHT / 2, OUTSIDE: -WEIGHT / 2 }

interface SquareCase {
  label: string
  stroke: Stroke
  samples: (left: number, top: number) => Point[]
}

/** Middle of the band on the left, right and top sides of a square at `left`, `top`. */
function bandSamples(align: Stroke['align']) {
  const inset = BAND_MIDDLE[align]
  return (left: number, top: number): Point[] => [
    [left + inset, top + SIZE / 2],
    [left + SIZE - 1 - inset, top + SIZE / 2],
    [left + SIZE / 2, top + inset]
  ]
}

const SQUARES: SquareCase[] = [
  { label: 'centre', stroke: RED_TO_BLUE, samples: bandSamples('CENTER') },
  {
    label: 'inside',
    stroke: { ...RED_TO_BLUE, align: 'INSIDE' },
    samples: bandSamples('INSIDE')
  },
  {
    label: 'outside',
    stroke: { ...RED_TO_BLUE, align: 'OUTSIDE' },
    samples: bandSamples('OUTSIDE')
  },
  {
    label: 'half opacity',
    stroke: { ...RED_TO_BLUE, opacity: 0.5 },
    samples: bandSamples('CENTER')
  },
  {
    label: 'dashed',
    stroke: { ...RED_TO_BLUE, dashPattern: [10, 10] },
    // Dashed where the canvas's dashes, half a dash at each corner, overlap SVG's from the corner.
    samples: (left, top) => [
      [left + 2, top],
      [left + 22, top]
    ]
  },
  { label: 'image', stroke: GREEN_IMAGE, samples: bandSamples('CENTER') }
]

const GAP = 30
const ROW = GAP
const LINE = { x: GAP, y: ROW + SIZE + 2 * GAP, width: 160 }
const TEXT = { x: LINE.x + LINE.width + GAP, y: LINE.y - 20, width: 60, height: 30 }

function squareLeft(index: number): number {
  return GAP + index * (SIZE + GAP)
}

function rectangleBlob(left: number, top: number, right: number, bottom: number): Uint8Array {
  const corners: Point[] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ]
  const blob = new Uint8Array(corners.length * 9 + 1)
  const view = new DataView(blob.buffer)
  for (const [index, [x, y]] of corners.entries()) {
    blob[index * 9] = index === 0 ? 1 : 2
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  }
  return blob
}

async function solidGreenPNG(): Promise<Uint8Array> {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(4, 4)
  if (!surface) throw new Error('no surface')
  surface.getCanvas().clear(ck.Color(0, 160, 0, 1))
  const image = surface.makeImageSnapshot()
  const png = image.encodeToBytes()
  image.delete()
  surface.delete()
  if (!png) throw new Error('no PNG')
  return png
}

async function buildScene(): Promise<{ graph: SceneGraph; pageId: string; frameId: string }> {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  graph.images.set(IMAGE_HASH, await solidGreenPNG())
  const frame = graph.createNode('FRAME', pageId, {
    width: squareLeft(SQUARES.length),
    height: LINE.y + GAP,
    fills: [WHITE],
    clipsContent: true
  })
  for (const [index, square] of SQUARES.entries()) {
    graph.createNode('RECTANGLE', frame.id, {
      x: squareLeft(index),
      y: ROW,
      width: SIZE,
      height: SIZE,
      fills: [],
      strokes: [square.stroke]
    })
  }
  graph.createNode('LINE', frame.id, {
    ...LINE,
    height: 0,
    strokeCap: 'TRIANGLE_FILLED',
    strokes: [{ ...RED_TO_BLUE, weight: 6 }]
  })
  graph.createNode('TEXT', frame.id, {
    ...TEXT,
    text: 'A',
    fills: [WHITE],
    strokes: [RED_TO_BLUE],
    strokeGeometry: [
      { windingRule: 'NONZERO', commandsBlob: rectangleBlob(0, 20, TEXT.width, TEXT.height) }
    ]
  })
  return { graph, pageId, frameId: frame.id }
}

function samplePoints(): { label: string; point: Point }[] {
  const squares = SQUARES.flatMap((square, index) =>
    square.samples(squareLeft(index), ROW).map((point) => ({ label: square.label, point }))
  )
  const shaft = LINE.y - 3
  const line: Point[] = [
    [LINE.x + 4, shaft],
    [LINE.x + LINE.width / 2, shaft],
    [LINE.x + LINE.width - 5, shaft],
    [LINE.x + 6, shaft - 6],
    [LINE.x + LINE.width - 7, shaft + 6]
  ]
  const text: Point[] = [10, 30, 50].map((x) => [TEXT.x + x, TEXT.y + 25])
  return [
    ...squares,
    ...line.map((point) => ({ label: 'line with arrow heads', point })),
    ...text.map((point) => ({ label: 'text', point }))
  ]
}

interface Raster {
  width: number
  data: number[]
}

function pixel(raster: Raster, [x, y]: Point): RGB {
  const offset = (y * raster.width + x) * 4
  return [raster.data[offset], raster.data[offset + 1], raster.data[offset + 2]]
}

async function canvasRaster(graph: SceneGraph, pageId: string, frameId: string): Promise<Raster> {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('no surface')
  const renderer = new SkiaRenderer(ck, surface)
  const inter = readFileSync(repoPath('packages/core/assets/InterVariable.ttf'))
  await fontManager.markLoaded('Inter', 'Regular', new Uint8Array(inter).buffer)
  await renderer.loadFonts()
  try {
    const png = renderNodesToImage(ck, renderer, graph, pageId, [frameId], {
      scale: 1,
      format: 'PNG'
    })
    if (!png) throw new Error('no canvas render')
    const image = ck.MakeImageFromEncoded(png)
    if (!image) throw new Error('canvas render does not decode')
    const pixels = image.readPixels(0, 0, {
      width: image.width(),
      height: image.height(),
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    const width = image.width()
    image.delete()
    if (!(pixels instanceof Uint8Array)) throw new Error('no 8-bit canvas pixels')
    return { width, data: Array.from(pixels) }
  } finally {
    surface.delete()
  }
}

async function browserRaster(page: Page, svg: string): Promise<Raster> {
  return page.evaluate(async (url) => {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2D context')
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return { width: canvas.width, data: Array.from(data) }
  }, svgDataURL(svg))
}

test('gradient and image strokes export as the canvas strokes them', async ({ page }) => {
  const { graph, pageId, frameId } = await buildScene()
  const svg = renderNodesToSVG(graph, pageId, [frameId], { xmlDeclaration: false })
  if (!svg) throw new Error('nothing exported')
  const [canvas, browser] = await Promise.all([
    canvasRaster(graph, pageId, frameId),
    browserRaster(page, svg)
  ])
  expect(browser.width).toBe(canvas.width)
  for (const { label, point } of samplePoints()) {
    const expected = pixel(canvas, point)
    const actual = pixel(browser, point)
    expect(expected, `${label} at ${point}: canvas draws the stroke`).not.toEqual([255, 255, 255])
    for (const [channel, value] of expected.entries()) {
      expect(
        Math.abs(actual[channel] - value),
        `${label} at ${point}: SVG ${actual} vs canvas ${expected}`
      ).toBeLessThanOrEqual(2)
    }
  }
})
