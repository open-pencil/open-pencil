import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { FigmaAPI, type FigmaFrameNode } from '@open-pencil/core/figma-api'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  blurLevels,
  levelWeights,
  makeProgressiveBlur,
  maskStops
} from '#core/canvas/blur/progressive'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * Red channel read from Figma 126 exports of a 256 px frame, through the plugin API's
 * `exportAsync`. A 200 px square at (28, 28) blurs the backdrop progressively from 0 to radius 32:
 * top to bottom over a black-to-white edge at x = 128 (rows, x = 88 to 168), and from x = 118 to
 * 138 over a black-to-white edge at y = 128 (columns, y = 88 to 168).
 */
const FIGMA: Record<string, number[]> = {
  'vertical row 31': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 11, 245, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254
  ],
  'vertical row 78': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    3, 6, 13, 25, 41, 61, 85, 113, 142, 170, 194, 214, 230, 242, 249, 253, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'vertical row 128': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 7, 11, 16, 22,
    28, 36, 45, 55, 66, 78, 91, 105, 120, 135, 150, 164, 177, 189, 200, 210, 219, 227, 233, 239,
    244, 248, 251, 252, 253, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'vertical row 208': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 5, 7, 9, 11, 13, 16, 19, 23, 27, 31, 36, 41, 46,
    51, 57, 63, 70, 76, 83, 91, 98, 106, 115, 123, 132, 140, 149, 157, 164, 172, 179, 185, 192, 198,
    204, 209, 214, 219, 224, 228, 232, 236, 239, 242, 244, 246, 248, 250, 252, 252, 253, 253, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'horizontal column 120': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    2, 2, 3, 6, 11, 23, 44, 83, 172, 211, 232, 244, 249, 252, 253, 253, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'horizontal column 128': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 9, 11, 13, 16, 19, 23,
    27, 31, 36, 42, 49, 57, 67, 78, 91, 107, 148, 165, 177, 188, 198, 206, 213, 219, 224, 229, 233,
    236, 239, 242, 244, 246, 247, 249, 250, 251, 252, 252, 252, 253, 253, 253, 254, 254, 254, 254,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'horizontal column 136': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 9, 11, 13, 15, 18, 21, 23, 27, 30, 34,
    38, 43, 48, 53, 59, 66, 73, 81, 89, 99, 111, 144, 156, 166, 174, 182, 189, 196, 202, 207, 212,
    217, 221, 225, 228, 232, 234, 237, 240, 242, 244, 246, 248, 249, 250, 251, 252, 252, 253, 253,
    254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254
  ],
  'horizontal column 160': [
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3, 4, 6, 7, 9, 12, 14, 17, 20, 23, 26, 30, 34, 38, 42, 47,
    52, 57, 63, 69, 75, 81, 88, 94, 101, 109, 116, 124, 131, 139, 146, 154, 161, 167, 174, 180, 186,
    192, 198, 203, 208, 213, 217, 221, 225, 229, 232, 235, 238, 241, 243, 246, 248, 249, 251, 252,
    252, 253, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254, 254
  ]
}

/**
 * Red from a Figma 126 export, x = 62 to 81 and y = 38 to 49: the top corner of a black 160×80
 * rectangle at (70, 40) turned by -30°, whose layer blur grows from 0 at its left edge to 16 at its
 * right edge, so the corner is sharp.
 */
const FIGMA_ROTATED_CORNER = [
  [
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255
  ],
  [
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255
  ],
  [
    255, 255, 255, 255, 255, 255, 255, 178, 63, 209, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255
  ],
  [255, 255, 255, 255, 255, 255, 255, 52, 0, 8, 109, 224, 254, 255, 255, 255, 255, 255, 255, 255],
  [255, 255, 255, 255, 255, 255, 138, 0, 0, 0, 1, 39, 146, 235, 254, 255, 255, 255, 255, 255],
  [255, 255, 255, 255, 255, 237, 23, 0, 0, 0, 0, 0, 5, 69, 173, 239, 253, 255, 255, 255],
  [255, 255, 255, 255, 255, 106, 0, 0, 0, 0, 0, 0, 0, 1, 21, 101, 190, 240, 253, 255],
  [255, 255, 255, 255, 210, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 43, 126, 201, 239],
  [255, 255, 255, 255, 65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 17, 68, 146],
  [255, 255, 255, 169, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 35],
  [255, 255, 245, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [255, 255, 129, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
]

type Pixels = (x: number, y: number) => number

function render(build: (api: FigmaAPI, frame: FigmaFrameNode) => void): Pixels {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const frame = api.createFrame()
  frame.resize(256, 256)
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
  frame.clipsContent = true
  build(api, frame)
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [frame.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: 256,
        height: 256,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return (x, y) => pixels[(y * 256 + x) * 4]
  } finally {
    image.delete()
  }
}

/** A black half below `edge` along `axis`, and a square of progressive background blur over it. */
function backdropRamp(axis: 'x' | 'y', start: [number, number], end: [number, number]): Pixels {
  return render((api, frame) => {
    const black = api.createRectangle()
    frame.appendChild(black)
    black.resize(axis === 'x' ? 128 : 256, axis === 'x' ? 256 : 128)
    black.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
    const glass = api.createRectangle()
    frame.appendChild(glass)
    glass.resize(200, 200)
    glass.x = 28
    glass.y = 28
    glass.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 0.004 }]
    glass.effects = [
      {
        type: 'BACKGROUND_BLUR',
        visible: true,
        blurType: 'PROGRESSIVE',
        radius: 32,
        startRadius: 0,
        startOffset: { x: start[0], y: start[1] },
        endOffset: { x: end[0], y: end[1] }
      }
    ]
  })
}

function worstDifference(ours: number[], figma: number[]): number {
  return Math.max(...ours.map((value, index) => Math.abs(value - figma[index])))
}

describe('progressive blur levels', () => {
  test('climb from one end sigma to the other in steps a mix of two draws as one blur', () => {
    const levels = blurLevels(0, 13.76)
    expect(levels[0]).toBe(0)
    expect(levels.at(-1)).toBe(13.76)
    for (const [index, level] of levels.slice(1).entries()) {
      const below = levels[index]
      expect(level).toBeGreaterThan(below)
      expect(level <= below * 1.4 || level <= below + 0.5).toBe(true)
    }
    expect(blurLevels(4, 4)).toEqual([4])
  })

  test('mix the two levels around a sigma so their variances average to its own', () => {
    const levels = [0, 0.5, 1, 1.5]
    const weights = levelWeights(levels, 1.2)
    expect(weights[0] + weights[1]).toBe(0)
    expect(weights[2] + weights[3]).toBeCloseTo(1, 10)
    expect(weights[2] * 1 + weights[3] * 1.5 ** 2).toBeCloseTo(1.2 ** 2, 10)
    expect(levelWeights(levels, 0)).toEqual([1, 0, 0, 0])
  })

  test('sample each mask at every level the ramp passes', () => {
    const levels = blurLevels(0, 4)
    const stops = maskStops(levels, 0, 4)
    expect(stops[0]).toBe(0)
    expect(stops.at(-1)).toBe(1)
    for (const level of levels) expect(stops).toContainEqual(level / 4)
    expect(stops).toEqual([...stops].sort((a, b) => a - b))
  })
  test('make no filter, and keep nothing, when CanvasKit cannot blur that far', () => {
    // A sigma too large for a float makes CanvasKit refuse the blur.
    const ramp = {
      start: { x: 0, y: 0 },
      end: { x: 0, y: 100 },
      startSigma: 0,
      endSigma: 1e40,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    }
    expect(makeProgressiveBlur(ck, ramp, ck.TileMode.Clamp)).toBeNull()
  })
})

describe('progressive blur against Figma', () => {
  test('grows with the ramp, a blur of its own radius on every row', () => {
    const at = backdropRamp('x', [0.5, 0], [0.5, 1])
    for (const y of [31, 78, 128, 208]) {
      const row = Array.from({ length: 81 }, (_, k) => at(88 + k, y))
      expect(worstDifference(row, FIGMA[`vertical row ${y}`])).toBeLessThanOrEqual(6)
    }
  })

  test('blurs across a steep ramp before along it, as Figma does', () => {
    const at = backdropRamp('y', [0.45, 0.5], [0.55, 0.5])
    for (const x of [120, 128, 136, 160]) {
      const column = Array.from({ length: 81 }, (_, k) => at(x, 88 + k))
      expect(worstDifference(column, FIGMA[`horizontal column ${x}`])).toBeLessThanOrEqual(6)
    }
  })

  test('follows a turned layer, and keeps what the turn moves past its box', () => {
    const at = render((api, frame) => {
      const rect = api.createRectangle()
      frame.appendChild(rect)
      rect.resize(160, 80)
      rect.x = 70
      rect.y = 40
      rect.rotation = -30
      rect.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
      rect.effects = [
        {
          type: 'LAYER_BLUR',
          visible: true,
          blurType: 'PROGRESSIVE',
          radius: 16,
          startRadius: 0,
          startOffset: { x: 0, y: 0.5 },
          endOffset: { x: 1, y: 0.5 }
        }
      ]
    })
    for (const [row, figma] of FIGMA_ROTATED_CORNER.entries()) {
      const ours = Array.from({ length: 20 }, (_, k) => at(62 + k, 38 + row))
      // The corner is sharp, so only antialiasing differs.
      expect(worstDifference(ours, figma)).toBeLessThanOrEqual(30)
    }
  })
})
