import { describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type Fill, type Stroke } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const SIZE = 40
const FONT_SIZE = 20
const WEIGHT = 2
const GLYPH = { left: 8, top: 8, right: 18, bottom: 28 }
const ROW = 18

const RED = { r: 1, g: 0, b: 0, a: 1 }
const BLACK = { r: 0, g: 0, b: 0, a: 1 }
const GREY = { r: 0.25, g: 0.25, b: 0.25, a: 1 }

type Command = [number, ...number[]]

function solid(color: Color, opacity = 1): Fill {
  return { type: 'SOLID', color, opacity, visible: true }
}

function blob(commands: Command[]): Uint8Array {
  const view = new DataView(new ArrayBuffer(4))
  return new Uint8Array(
    commands.flatMap(([op, ...args]) => [
      op,
      ...args.flatMap((value) => {
        view.setFloat32(0, value, true)
        return [view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)]
      })
    ])
  )
}

function rectangle(left: number, top: number, right: number, bottom: number): Command[] {
  return [[1, left, top], [2, right, top], [2, right, bottom], [2, left, bottom], [0]]
}

function reversedRectangle(left: number, top: number, right: number, bottom: number): Command[] {
  return [[1, left, top], [2, left, bottom], [2, right, bottom], [2, right, top], [0]]
}

/** The band Figma saves for a text stroke: `WEIGHT` to either side of the glyph's outline. */
function centredBand(baselineShift: number): Uint8Array {
  const { left, right } = GLYPH
  const top = GLYPH.top + baselineShift
  const bottom = GLYPH.bottom + baselineShift
  return blob([
    ...rectangle(left - WEIGHT, top - WEIGHT, right + WEIGHT, bottom + WEIGHT),
    ...reversedRectangle(left + WEIGHT, top + WEIGHT, right - WEIGHT, bottom - WEIGHT)
  ])
}

const ON_PATH = {
  textPathData: {
    network: { vertices: [], segments: [], regions: [] },
    normalizedSize: { x: SIZE, y: SIZE },
    tValue: 0,
    forward: true
  },
  textPathBox: { x: 0, y: 0, width: SIZE, height: SIZE }
}

interface GlyphPlacement {
  baselineShift?: number
  onPath?: boolean
}

/** A text of one saved square glyph, red, stroked in 60 % black; returns the page's pixels. */
function renderStrokedGlyph(
  aligns: Stroke['align'] | Stroke['align'][],
  { baselineShift = 0, onPath = false }: GlyphPlacement = {}
) {
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  graph.createNode('RECTANGLE', page.id, { width: SIZE, height: SIZE, fills: [solid(GREY)] })
  const glyphWidth = (GLYPH.right - GLYPH.left) / FONT_SIZE
  const glyphHeight = (GLYPH.bottom - GLYPH.top) / FONT_SIZE
  graph.createNode('TEXT', page.id, {
    width: SIZE,
    height: SIZE,
    text: 'I',
    fontFamily: 'Acme Sans',
    fontSize: FONT_SIZE,
    fills: [solid(RED)],
    derivedTextGlyphs: [
      {
        commandsBlob: blob(rectangle(0, 0, glyphWidth, glyphHeight)),
        x: GLYPH.left,
        y: GLYPH.bottom + baselineShift,
        fontSize: FONT_SIZE,
        firstCharacter: 0
      }
    ],
    strokeWeight: WEIGHT,
    strokes: [aligns].flat().map((align) => ({ ...solid(BLACK, 0.6), weight: WEIGHT, align })),
    strokeGeometry: [{ windingRule: 'NONZERO', commandsBlob: centredBand(baselineShift) }],
    ...(onPath ? ON_PATH : {})
  })
  const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    renderer.pageId = page.id
    renderer.renderSceneToCanvas(surface.getCanvas(), graph, page.id)
    surface.flush()
    const image = surface.makeImageSnapshot()
    const pixels = image.readPixels(0, 0, {
      width: SIZE,
      height: SIZE,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    const read = expectDefined(pixels, 'pixels')
    return (x: number, y = ROW) =>
      Array.from(read.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 3))
  } finally {
    renderer.destroy()
  }
}

const RED_PIXEL = [255, 0, 0]
const GREY_PIXEL = [64, 64, 64]
const DARK_RED_PIXEL = [102, 0, 0]
const DARK_GREY_PIXEL = [26, 26, 26]

describe('saved text strokes keep to their side of the glyphs', () => {
  test('an outside stroke leaves the glyph in its fill', () => {
    const at = renderStrokedGlyph('OUTSIDE')

    expect(at(GLYPH.left)).toEqual(RED_PIXEL)
    expect(at(GLYPH.left - 1)).toEqual(DARK_GREY_PIXEL)
  })

  test('an inside stroke stays off the background', () => {
    const at = renderStrokedGlyph('INSIDE')

    expect(at(GLYPH.left)).toEqual(DARK_RED_PIXEL)
    expect(at(GLYPH.left - 1)).toEqual(GREY_PIXEL)
  })

  test('an outside stroke clears the glyph at the baseline its fill is drawn on', () => {
    const at = renderStrokedGlyph('OUTSIDE', { baselineShift: 0.4 })

    expect(at(13, GLYPH.top)).toEqual(RED_PIXEL)
    expect(at(13, GLYPH.bottom - 1)).toEqual(RED_PIXEL)
  })

  test('a stroke drawn under path text keeps its whole band', () => {
    const at = renderStrokedGlyph('INSIDE', { onPath: true })

    expect(at(GLYPH.left - 1)).toEqual(DARK_GREY_PIXEL)
  })

  test('an inside and an outside stroke on one text each keep their side', () => {
    const at = renderStrokedGlyph(['INSIDE', 'OUTSIDE'])

    expect(at(GLYPH.left)).toEqual(DARK_RED_PIXEL)
    expect(at(GLYPH.left - 1)).toEqual(DARK_GREY_PIXEL)
  })

  test('a centre stroke draws the whole band', () => {
    const at = renderStrokedGlyph('CENTER')

    expect(at(GLYPH.left)).toEqual(DARK_RED_PIXEL)
    expect(at(GLYPH.left - 1)).toEqual(DARK_GREY_PIXEL)
  })
})
