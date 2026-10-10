import { describe, expect, test } from 'bun:test'

import type { Fill, GradientTransform } from '@open-pencil/scene-graph'
import { SceneGraph } from '@open-pencil/scene-graph'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas/renderer'

import { expectDefined } from '#tests/helpers/assert'

const WIDTH = 200
const HEIGHT = 120
const STOPS = [
  { position: 0, color: { r: 1, g: 0.2, b: 0.1, a: 1 } },
  { position: 0.5, color: { r: 1, g: 0.9, b: 0.2, a: 1 } },
  { position: 1, color: { r: 0.1, g: 0.3, b: 1, a: 1 } }
]

type Hue = 'red' | 'yellow' | 'blue'

function hue([r, g, b]: number[]): Hue | 'other' {
  if (r > 200 && g < 120 && b < 120) return 'red'
  if (r > 200 && g > 180 && b < 120) return 'yellow'
  if (b > 200 && r < 120) return 'blue'
  return 'other'
}

async function render(type: Fill['type'], transform: number[]) {
  const ck = await initCanvasKit()
  const surface = expectDefined(ck.MakeSurface(WIDTH, HEIGHT), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  const graph = new SceneGraph()
  const page = expectDefined(graph.getPages()[0], 'page')
  const [m00, m01, m02, m10, m11, m12] = transform
  const gradientTransform: GradientTransform = { m00, m01, m02, m10, m11, m12 }
  const node = graph.createNode('RECTANGLE', page.id, {
    width: WIDTH,
    height: HEIGHT,
    fills: [
      {
        type,
        color: STOPS[0].color,
        opacity: 1,
        visible: true,
        gradientStops: STOPS,
        gradientTransform
      }
    ]
  })
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    renderer.renderShape(canvas, node, graph)
    surface.flush()
    const image = surface.makeImageSnapshot()
    try {
      const pixels = expectDefined(
        image.readPixels(0, 0, {
          width: WIDTH,
          height: HEIGHT,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
      return (x: number, y: number) =>
        hue(Array.from(pixels.slice((y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3)))
    } finally {
      image.delete()
    }
  } finally {
    renderer.destroy()
  }
}

const C = Math.SQRT1_2

// Each case was drawn in Figma desktop 126 on a 200 × 120 rectangle with the same stops and
// transform (the plugin API's gradientTransform, which `.fig` files and the clipboard store as
// is); the points are where Figma shows red, the yellow middle stop, and blue.
const FIGMA_CASES: Array<{
  name: string
  type: Fill['type']
  transform: number[]
  expected: Array<[number, number, Hue]>
}> = [
  {
    name: 'identity runs left to right',
    type: 'GRADIENT_LINEAR',
    transform: [1, 0, 0, 0, 1, 0],
    expected: [
      [5, 60, 'red'],
      [100, 60, 'yellow'],
      [195, 60, 'blue']
    ]
  },
  {
    name: "Figma's default runs top to bottom",
    type: 'GRADIENT_LINEAR',
    transform: [0, 1, 0, -1, 0, 1],
    expected: [
      [100, 3, 'red'],
      [100, 60, 'yellow'],
      [100, 117, 'blue']
    ]
  },
  {
    name: 'a turned gradient keeps its bands along the second axis',
    type: 'GRADIENT_LINEAR',
    transform: [C, C, 0.5 - C, -C, C, 0.5],
    expected: [
      [3, 3, 'red'],
      [40, 96, 'yellow'],
      [160, 24, 'yellow'],
      [197, 117, 'blue']
    ]
  },
  {
    name: 'a scaled and offset gradient',
    type: 'GRADIENT_LINEAR',
    transform: [2, 0, -0.5, 0, 1, 0.2],
    expected: [
      [30, 60, 'red'],
      [100, 60, 'yellow'],
      [170, 60, 'blue']
    ]
  },
  {
    name: 'radial centred where the transform puts (0.5, 0.5)',
    type: 'GRADIENT_RADIAL',
    transform: [2, 0, -0.2, 0, 1.5, -0.1],
    expected: [
      [70, 48, 'red'],
      [195, 115, 'blue']
    ]
  },
  {
    name: 'angular starts at +x and turns clockwise',
    type: 'GRADIENT_ANGULAR',
    transform: [1, 0, 0, 0, 1, 0],
    expected: [
      [180, 66, 'red'],
      [20, 60, 'yellow'],
      [180, 54, 'blue']
    ]
  },
  {
    name: "angular with Figma's default starts downward",
    type: 'GRADIENT_ANGULAR',
    transform: [0, 1, 0, -1, 0, 1],
    expected: [
      [94, 115, 'red'],
      [100, 5, 'yellow'],
      [106, 115, 'blue']
    ]
  },
  {
    name: 'diamond centred where the transform puts (0.5, 0.5)',
    type: 'GRADIENT_DIAMOND',
    transform: [2, 0, -0.2, 0, 1.5, -0.1],
    expected: [
      [70, 48, 'red'],
      [195, 115, 'blue']
    ]
  }
]

describe('gradients match Figma', () => {
  for (const { name, type, transform, expected } of FIGMA_CASES) {
    test(name, async () => {
      const at = await render(type, transform)
      expect(expected.map(([x, y]) => at(x, y))).toEqual(expected.map(([, , hue]) => hue))
    })
  }
})
