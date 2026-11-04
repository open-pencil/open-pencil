import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import { SkiaRenderer } from '#core/canvas/renderer'
import { drawDerivedText } from '#core/canvas/text/derived'
import { getCanvasKit } from '#core/canvaskit'

let ck: Awaited<ReturnType<typeof getCanvasKit>>

beforeAll(async () => {
  ck = await getCanvasKit()
})

const MOVE_TO = 1
const LINE_TO = 2
const CANVAS_SIDE = 24

function triangleCommandsBlob(): Uint8Array {
  const points = [
    [0, 0],
    [1, 0],
    [0, 1]
  ]
  const blob = new Uint8Array(points.length * 9 + 1)
  const view = new DataView(blob.buffer)
  for (const [index, [x, y]] of points.entries()) {
    const offset = index * 9
    blob[offset] = index === 0 ? MOVE_TO : LINE_TO
    view.setFloat32(offset + 1, x, true)
    view.setFloat32(offset + 5, y, true)
  }
  return blob
}

function regularTwentyPixelSavedText(graph: SceneGraph) {
  const page = graph.getPages()[0]
  return graph.createNode('TEXT', page.id, {
    text: 'A',
    width: CANVAS_SIDE,
    height: CANVAS_SIDE,
    fontSize: 20,
    fontWeight: 400,
    derivedTextGlyphs: [
      { commandsBlob: triangleCommandsBlob(), x: 2, y: 22, fontSize: 20, firstCharacter: 0 }
    ]
  })
}

function savedTextAlphas(scale: number): Uint8Array {
  const text = regularTwentyPixelSavedText(new SceneGraph())
  const side = CANVAS_SIDE * scale
  const surface = expectDefined(ck.MakeSurface(side, side), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    canvas.scale(scale, scale)
    renderer.fillPaint.setColor(ck.BLACK)
    expect(drawDerivedText(renderer, canvas, text)).toBeTrue()
    const pixels = expectDefined(
      canvas.readPixels(0, 0, {
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB,
        width: side,
        height: side
      }),
      'pixels'
    )
    return Uint8Array.from(pixels.filter((_, index) => index % 4 === 3))
  } finally {
    renderer.destroy()
  }
}

describe('saved glyph antialiasing', () => {
  test.each([1, 5])('smooths regular 20px saved glyph edges at scale %d', (scale) => {
    const alphas = savedTextAlphas(scale)
    const side = CANVAS_SIDE * scale
    const opaque = alphas.filter((alpha) => alpha === 255)
    const partialCoverage = alphas.filter((alpha) => alpha > 0 && alpha < 255)
    expect(opaque.length).toBeGreaterThan(side)
    expect(partialCoverage.length).toBeGreaterThan(side / 2)
  })
})
