import { beforeAll, describe, expect, test } from 'bun:test'

import type { CanvasKit } from '@open-pencil/canvaskit'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { SceneGraph, type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

let ck: CanvasKit

beforeAll(async () => {
  ck = await getCanvasKit()
})

const WIDTH = 32
const HEIGHT = 24

function rgbaInfo(width: number, height: number) {
  return {
    width,
    height,
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB
  }
}

const KNUTH_MULTIPLICATIVE_HASH = 2654435761

/** Opaque noise, the same every run: any smoothing between neighbouring pixels shows in every channel. */
function noise(): Uint8Array<ArrayBuffer> {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
  for (let index = 0; index < pixels.length; index++) {
    pixels[index] = index % 4 === 3 ? 255 : Math.imul(index + 1, KNUTH_MULTIPLICATIVE_HASH) >>> 24
  }
  return pixels
}

function encoded(pixels: Uint8Array): Uint8Array {
  const image = expectDefined(
    ck.MakeImage(rgbaInfo(WIDTH, HEIGHT), pixels, WIDTH * 4),
    'noise image'
  )
  const bytes = expectDefined(image.encodeToBytes(ck.ImageFormat.PNG, 100), 'noise PNG')
  image.delete()
  return bytes
}

function imageFill(fill: Partial<Fill> = {}): Fill {
  return {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: 'noise',
    imageScaleMode: 'FILL',
    ...fill
  }
}

function graphWithFrame(
  pixels: Uint8Array,
  build: (graph: SceneGraph, frameId: string) => void,
  frame: Partial<SceneNode> = {}
) {
  const graph = new SceneGraph()
  graph.images.set('noise', encoded(pixels))
  const exportedNode = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: WIDTH,
    height: HEIGHT,
    fills: [],
    ...frame
  })
  build(graph, exportedNode.id)
  return { graph, exportedNode }
}

function withRenderer<T>(node: SceneNode, use: (renderer: SkiaRenderer) => T): T {
  const surface = expectDefined(ck.MakeSurface(node.width, node.height), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  try {
    return use(renderer)
  } finally {
    renderer.destroy()
  }
}

function exportedPixels(renderer: SkiaRenderer, graph: SceneGraph, node: SceneNode) {
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [node.id], {
      scale: 1,
      format: 'PNG'
    }),
    'png'
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png), 'export')
  const read = image.readPixels(0, 0, rgbaInfo(node.width, node.height))
  image.delete()
  return Uint8Array.from(expectDefined(read, 'export pixels'))
}

function exportedFrame(
  pixels: Uint8Array,
  build: (graph: SceneGraph, frameId: string) => void,
  frame: Partial<SceneNode> = {},
  drawnBefore = false
) {
  const { graph, exportedNode } = graphWithFrame(pixels, build, frame)
  return withRenderer(exportedNode, (renderer) => {
    if (drawnBefore) {
      renderer.renderSceneToCanvas(renderer.surface.getCanvas(), graph, graph.getPages()[0].id)
    }
    return exportedPixels(renderer, graph, exportedNode)
  })
}

function exported(
  pixels: Uint8Array,
  layer: Partial<SceneNode>,
  fill: Partial<Fill> = {},
  drawnBefore = false
) {
  const { width = WIDTH, height = HEIGHT } = layer
  return exportedFrame(
    pixels,
    (graph, frameId) => {
      graph.createNode('RECTANGLE', frameId, {
        width,
        height,
        fills: [imageFill(fill)],
        ...layer
      })
    },
    { width, height },
    drawnBefore
  )
}

/** Each output pixel as the share of every image pixel it covers, the image moved by `dx, dy`. */
function areaWeighted(pixels: Uint8Array, dx: number, dy: number) {
  const at = (x: number, y: number, channel: number) => pixels[(y * WIDTH + x) * 4 + channel]
  return (x: number, y: number, channel: number) =>
    (1 - dx) * (1 - dy) * at(x, y, channel) +
    dx * (1 - dy) * at(x - 1, y, channel) +
    (1 - dx) * dy * at(x, y - 1, channel) +
    dx * dy * at(x - 1, y - 1, channel)
}

function meanInteriorError(
  output: Uint8Array,
  expected: (x: number, y: number, channel: number) => number
): number {
  let total = 0
  let count = 0
  for (let y = 1; y < HEIGHT - 1; y++) {
    for (let x = 1; x < WIDTH - 1; x++) {
      for (let channel = 0; channel < 3; channel++) {
        total += Math.abs(output[(y * WIDTH + x) * 4 + channel] - expected(x, y, channel))
        count++
      }
    }
  }
  return total / count
}

describe('raster export of an image at its own size', () => {
  test.each([
    { mode: 'a fill', fill: {} },
    { mode: 'a tile', fill: { imageScaleMode: 'TILE' as const } }
  ])('copies its pixels as they are in $mode', ({ fill }) => {
    const pixels = noise()

    expect(exported(pixels, {}, fill)).toEqual(pixels)
  })

  test.each([false, true])(
    'copies its pixels as they are on a layer drawn with its effects (drawn before: %p)',
    (drawnBefore) => {
      const pixels = noise()
      const shadow = {
        type: 'DROP_SHADOW' as const,
        color: { r: 0, g: 0, b: 0, a: 0.5 },
        offset: { x: 40, y: 40 },
        radius: 0,
        spread: 0,
        visible: true
      }

      expect(exported(pixels, { effects: [shadow] }, {}, drawnBefore)).toEqual(pixels)
    }
  )

  test('copies its pixels as they are when the image turns a quarter', () => {
    const pixels = noise()
    const turned = new Uint8Array(pixels.length)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const from = (y * WIDTH + x) * 4
        const to = (x * HEIGHT + (HEIGHT - 1 - y)) * 4
        turned.set(pixels.subarray(from, from + 4), to)
      }
    }

    expect(exported(pixels, { width: HEIGHT, height: WIDTH }, { imageRotation: 90 })).toEqual(
      turned
    )
  })

  test('copies its pixels as they are when the layer is flipped', () => {
    const pixels = noise()
    const flipped = new Uint8Array(pixels.length)
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const from = (y * WIDTH + x) * 4
        const to = (y * WIDTH + (WIDTH - 1 - x)) * 4
        flipped.set(pixels.subarray(from, from + 4), to)
      }
    }

    expect(exported(pixels, { flipX: true })).toEqual(flipped)
  })
})

describe('raster export of an image at its own size off whole pixels', () => {
  test.each([
    { dx: 0.25, dy: 0.75 },
    { dx: 0.75, dy: 0.25 }
  ])('spreads each pixel by the area it covers at $dx, $dy', ({ dx, dy }) => {
    const pixels = noise()
    const output = exported(pixels, { x: dx, y: dy })

    expect(meanInteriorError(output, areaWeighted(pixels, dx, dy))).toBeLessThan(1)
  })

  test('spreads its pixels when a parent puts it off whole pixels', () => {
    const pixels = noise()
    const output = exportedFrame(pixels, (graph, frameId) => {
      const parent = graph.createNode('FRAME', frameId, {
        x: 0.25,
        y: 0.75,
        width: WIDTH,
        height: HEIGHT,
        fills: []
      })
      graph.createNode('RECTANGLE', parent.id, {
        width: WIDTH,
        height: HEIGHT,
        fills: [imageFill()]
      })
    })

    expect(meanInteriorError(output, areaWeighted(pixels, 0.25, 0.75))).toBeLessThan(1)
  })

  test('copies its pixels when offsets of parent and export add up to whole pixels', () => {
    const pixels = noise()
    const output = exportedFrame(
      pixels,
      (graph, frameId) => {
        const parent = graph.createNode('FRAME', frameId, {
          x: 0.25,
          y: 0.5,
          width: WIDTH,
          height: HEIGHT,
          fills: []
        })
        graph.createNode('RECTANGLE', parent.id, {
          x: -0.25,
          y: -0.5,
          width: WIDTH,
          height: HEIGHT,
          fills: [imageFill()]
        })
      },
      { x: 100.5, y: 7.25 }
    )

    expect(output).toEqual(pixels)
  })

  test('spreads its pixels again when a parent moves off whole pixels after an export', () => {
    const pixels = noise()
    const shadow = {
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 0.5 },
      offset: { x: 40, y: 40 },
      radius: 0,
      spread: 0,
      visible: true
    }
    let parentId = ''
    const { graph, exportedNode } = graphWithFrame(pixels, (built, frameId) => {
      const parent = built.createNode('FRAME', frameId, {
        width: WIDTH,
        height: HEIGHT,
        fills: []
      })
      parentId = parent.id
      built.createNode('RECTANGLE', parent.id, {
        width: WIDTH,
        height: HEIGHT,
        fills: [imageFill()],
        effects: [shadow]
      })
    })

    const reexported = withRenderer(exportedNode, (renderer) => {
      exportedPixels(renderer, graph, exportedNode)
      graph.updateNode(parentId, { x: 0.25 })
      renderer.invalidateNodePicture(parentId)
      return exportedPixels(renderer, graph, exportedNode)
    })
    const fresh = withRenderer(exportedNode, (renderer) =>
      exportedPixels(renderer, graph, exportedNode)
    )

    expect(reexported).toEqual(fresh)
    expect(reexported).not.toEqual(pixels)
  })
})

describe('raster export of a pattern whose source holds an image at its own size', () => {
  test('keeps the pattern smooth when it scales the source up', () => {
    const pixels = noise()
    const output = exportedFrame(
      pixels,
      (graph, frameId) => {
        const source = graph.createNode('RECTANGLE', frameId, {
          x: WIDTH * 2,
          width: WIDTH,
          height: HEIGHT,
          fills: [imageFill()]
        })
        graph.createNode('RECTANGLE', frameId, {
          width: WIDTH * 2,
          height: HEIGHT * 2,
          fills: [
            {
              type: 'PATTERN',
              color: { r: 0, g: 0, b: 0, a: 1 },
              opacity: 1,
              visible: true,
              sourceNodeId: source.id,
              scale: 2
            }
          ]
        })
      },
      { width: WIDTH * 3, height: HEIGHT * 2 }
    )

    let equalNeighbours = 0
    let pairs = 0
    for (let y = 0; y < HEIGHT * 2; y++) {
      for (let x = 0; x + 1 < WIDTH * 2; x++) {
        const left = (y * WIDTH * 3 + x) * 4
        const sameColor = [0, 1, 2].every(
          (channel) => output[left + channel] === output[left + 4 + channel]
        )
        equalNeighbours += sameColor ? 1 : 0
        pairs++
      }
    }
    expect(equalNeighbours / pairs).toBeLessThan(0.1)
  })
})
