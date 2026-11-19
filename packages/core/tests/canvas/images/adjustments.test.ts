import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type ImageFilters } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { maxOf } from '@open-pencil/std/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

/**
 * Pixels Figma exports for a 16×1 image with these colours under each set of adjustments, as the
 * plugin API takes them, at 1×. The last row sets all seven at once.
 */
const COLORS: number[][] = [
  [0, 0, 0],
  [68, 68, 68],
  [136, 136, 136],
  [204, 204, 204],
  [255, 255, 255],
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [204, 153, 0],
  [34, 221, 51],
  [102, 51, 170],
  [238, 119, 85],
  [17, 85, 136],
  [187, 221, 238],
  [85, 34, 17],
  [153, 187, 102]
]
const FIGMA: [ImageFilters, number[][]][] = [
  [
    { exposure: -1 },
    [
      [0, 0, 0],
      [8, 8, 8],
      [18, 18, 18],
      [36, 36, 36],
      [101, 101, 101],
      [40, 0, 0],
      [0, 59, 0],
      [0, 0, 36],
      [32, 22, 0],
      [0, 39, 0],
      [13, 6, 22],
      [39, 15, 8],
      [0, 11, 18],
      [31, 43, 50],
      [10, 4, 2],
      [22, 29, 8]
    ]
  ],
  [
    { exposure: 1 },
    [
      [0, 0, 0],
      [237, 237, 237],
      [252, 252, 252],
      [254, 254, 254],
      [255, 255, 255],
      [255, 244, 244],
      [252, 255, 252],
      [223, 223, 255],
      [255, 253, 249],
      [251, 255, 251],
      [250, 233, 255],
      [255, 251, 250],
      [228, 244, 255],
      [254, 255, 255],
      [255, 204, 190],
      [253, 254, 251]
    ]
  ],
  [
    { contrast: -1 },
    [
      [17, 17, 17],
      [79, 79, 79],
      [132, 132, 132],
      [182, 182, 182],
      [220, 220, 220],
      [252, 0, 0],
      [0, 227, 0],
      [52, 29, 255],
      [192, 143, 0],
      [0, 201, 28],
      [113, 60, 181],
      [228, 111, 78],
      [34, 93, 146],
      [163, 196, 213],
      [104, 49, 30],
      [139, 172, 89]
    ]
  ],
  [
    { contrast: 1 },
    [
      [3, 3, 3],
      [52, 52, 52],
      [147, 147, 147],
      [219, 219, 219],
      [255, 255, 255],
      [255, 28, 15],
      [48, 255, 36],
      [0, 0, 231],
      [228, 173, 42],
      [68, 241, 70],
      [82, 33, 149],
      [255, 137, 102],
      [0, 69, 117],
      [198, 233, 250],
      [71, 23, 7],
      [174, 209, 121]
    ]
  ],
  [
    { saturation: -1 },
    [
      [0, 0, 0],
      [68, 68, 68],
      [136, 136, 136],
      [204, 204, 204],
      [255, 255, 255],
      [126, 126, 126],
      [219, 219, 219],
      [77, 77, 77],
      [161, 161, 161],
      [191, 191, 191],
      [80, 80, 80],
      [153, 153, 153],
      [82, 82, 82],
      [216, 216, 216],
      [50, 50, 50],
      [176, 176, 176]
    ]
  ],
  [
    { saturation: 1 },
    [
      [0, 0, 0],
      [68, 68, 68],
      [136, 136, 136],
      [204, 204, 204],
      [255, 255, 255],
      [255, 1, 0],
      [1, 255, 1],
      [1, 0, 255],
      [204, 153, 0],
      [0, 222, 41],
      [112, 1, 203],
      [255, 108, 50],
      [0, 85, 137],
      [158, 225, 255],
      [88, 32, 0],
      [142, 192, 1]
    ]
  ],
  [
    { temperature: -1 },
    [
      [0, 5, 20],
      [20, 70, 112],
      [100, 138, 188],
      [169, 207, 255],
      [219, 255, 255],
      [252, 16, 71],
      [0, 255, 111],
      [0, 45, 255],
      [197, 154, 89],
      [0, 222, 118],
      [0, 60, 221],
      [228, 121, 136],
      [0, 89, 185],
      [136, 224, 255],
      [78, 36, 56],
      [130, 188, 157]
    ]
  ],
  [
    { temperature: 1 },
    [
      [15, 0, 0],
      [80, 67, 24],
      [153, 134, 85],
      [225, 202, 148],
      [255, 253, 195],
      [255, 0, 0],
      [59, 255, 0],
      [120, 0, 202],
      [207, 153, 0],
      [66, 221, 0],
      [132, 44, 122],
      [243, 118, 13],
      [78, 82, 90],
      [215, 219, 181],
      [86, 34, 0],
      [165, 186, 31]
    ]
  ],
  [
    { tint: -1 },
    [
      [0, 5, 0],
      [0, 79, 67],
      [66, 150, 135],
      [133, 220, 203],
      [182, 255, 254],
      [218, 84, 0],
      [0, 255, 0],
      [0, 65, 255],
      [156, 169, 0],
      [0, 230, 48],
      [0, 76, 170],
      [195, 143, 83],
      [0, 96, 136],
      [95, 236, 237],
      [53, 51, 14],
      [76, 199, 100]
    ]
  ],
  [
    { tint: 1 },
    [
      [9, 0, 1],
      [107, 49, 69],
      [185, 116, 137],
      [255, 183, 205],
      [255, 234, 255],
      [255, 0, 25],
      [151, 244, 24],
      [124, 0, 255],
      [247, 131, 24],
      [142, 210, 54],
      [149, 0, 171],
      [255, 81, 88],
      [98, 67, 137],
      [250, 202, 239],
      [114, 0, 21],
      [206, 171, 104]
    ]
  ],
  [
    { highlights: -1 },
    [
      [0, 0, 0],
      [68, 68, 68],
      [131, 131, 131],
      [157, 157, 157],
      [246, 246, 246],
      [255, 0, 0],
      [0, 216, 0],
      [0, 0, 255],
      [180, 130, 0],
      [0, 180, 0],
      [102, 51, 170],
      [219, 103, 70],
      [17, 85, 136],
      [134, 173, 194],
      [85, 34, 17],
      [120, 153, 69]
    ]
  ],
  [
    { highlights: 1 },
    [
      [0, 0, 0],
      [68, 68, 68],
      [141, 141, 141],
      [233, 233, 233],
      [255, 255, 255],
      [255, 0, 0],
      [186, 255, 186],
      [0, 0, 255],
      [222, 175, 76],
      [144, 241, 147],
      [102, 51, 170],
      [251, 137, 105],
      [17, 85, 136],
      [228, 243, 250],
      [85, 34, 17],
      [186, 213, 148]
    ]
  ],
  [
    { shadows: -1 },
    [
      [0, 0, 0],
      [54, 54, 54],
      [136, 136, 136],
      [204, 204, 204],
      [255, 255, 255],
      [254, 0, 0],
      [0, 255, 0],
      [0, 0, 218],
      [204, 153, 0],
      [34, 221, 51],
      [84, 41, 142],
      [238, 119, 85],
      [9, 70, 114],
      [187, 221, 238],
      [65, 26, 12],
      [153, 187, 102]
    ]
  ],
  [
    { shadows: 1 },
    [
      [0, 0, 0],
      [85, 85, 85],
      [136, 136, 136],
      [204, 204, 204],
      [255, 255, 255],
      [255, 9, 9],
      [0, 255, 0],
      [20, 20, 255],
      [204, 153, 0],
      [34, 221, 51],
      [122, 63, 199],
      [238, 119, 85],
      [28, 102, 160],
      [187, 221, 238],
      [110, 45, 24],
      [153, 187, 102]
    ]
  ],
  [
    {
      exposure: 0.25,
      contrast: 0.3,
      saturation: 0.4,
      temperature: -0.3,
      tint: 0.2,
      highlights: -0.4,
      shadows: 0.35
    },
    [
      [0, 0, 10],
      [117, 103, 146],
      [195, 185, 216],
      [233, 226, 246],
      [255, 253, 255],
      [255, 97, 106],
      [153, 255, 153],
      [51, 51, 255],
      [249, 197, 122],
      [119, 247, 127],
      [151, 78, 255],
      [255, 171, 162],
      [41, 131, 224],
      [218, 236, 255],
      [156, 37, 43],
      [195, 226, 139]
    ]
  ]
]

function rgba(colors: number[][], alpha = 255) {
  return {
    info: {
      width: colors.length,
      height: 1,
      alphaType: ck.AlphaType.Unpremul,
      colorType: ck.ColorType.RGBA_8888,
      colorSpace: ck.ColorSpace.SRGB
    },
    pixels: Uint8Array.from(colors.flatMap((color) => [...color, alpha]))
  }
}

/** The exported pixels of an image of `colors` filled into a layer of its size with `filters`. */
function exported(colors: number[][], filters: ImageFilters, alpha = 255): number[][] {
  const { info, pixels } = rgba(colors, alpha)
  const source = expectDefined(ck.MakeImage(info, pixels, colors.length * 4), 'source image')
  const png = expectDefined(source.encodeToBytes(ck.ImageFormat.PNG, 100), 'source PNG')
  source.delete()
  // The renderer keeps decoded images by hash, so each source needs its own.
  const hash = computeImageHash(png)
  const graph = new SceneGraph()
  graph.images.set(hash, png)
  const layer = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: colors.length,
    height: 1,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: hash,
        imageScaleMode: 'FILL',
        filters
      }
    ]
  })
  const out = expectDefined(
    renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [layer.id], {
      scale: 1,
      format: 'PNG'
    }),
    'export'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(out), 'exported image')
  const read = expectDefined(image.readPixels(0, 0, info), 'exported pixels')
  image.delete()
  return colors.map((_, index) => Array.from(read.slice(index * 4, index * 4 + 4)))
}

describe('image adjustments', () => {
  test.each(FIGMA)('match Figma within one level: %o', (filters, figma) => {
    const pixels = exported(COLORS, filters)
    const worst = maxOf(
      pixels.flatMap((pixel, index) => figma[index].map((value, c) => Math.abs(pixel[c] - value)))
    )
    expect(worst).toBeLessThanOrEqual(1)
  })

  test('leave an image as it is when every adjustment is 0', () => {
    const zero = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 }
    expect(exported(COLORS, zero).map((pixel) => pixel.slice(0, 3))).toEqual(COLORS)
  })

  test('adjust a translucent pixel as its opaque colour, as Figma does', () => {
    // Figma: (200, 80, 40) at alpha 128 with saturation −1 exports (118, 118, 118, 128).
    const [pixel] = exported([[200, 80, 40]], { saturation: -1 }, 128)
    expect(pixel[3]).toBe(128)
    for (const channel of pixel.slice(0, 3)) expect(Math.abs(channel - 118)).toBeLessThanOrEqual(1)
  })
})
