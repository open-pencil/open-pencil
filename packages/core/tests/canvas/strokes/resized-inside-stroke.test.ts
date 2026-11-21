import { afterAll, afterEach, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())
afterEach(() => setTextMeasurer(null))

const WEIGHT = 8

function box(left: number, top: number, right: number, bottom: number): Array<[number, number]> {
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom]
  ]
}

/** A closed rectangle, the outline a 40 px inside stroke was baked from. */
function outlineBlob(width: number, height: number): Uint8Array {
  const contours = [box(0, 0, width, height), box(WEIGHT, WEIGHT, width - WEIGHT, height - WEIGHT)]
  const commands = contours.flatMap((points) => [
    ...points.map(([x, y], index) => [index === 0 ? 1 : 2, x, y] as const),
    [0, 0, 0] as const
  ])
  const blob = new Uint8Array(commands.reduce((length, [command]) => length + (command ? 9 : 1), 0))
  const view = new DataView(blob.buffer)
  let offset = 0
  for (const [command, x, y] of commands) {
    blob[offset++] = command
    if (command) {
      view.setFloat32(offset, x, true)
      view.setFloat32(offset + 4, y, true)
      offset += 8
    }
  }
  return blob
}

function pixel(pixels: Uint8Array, width: number, x: number, y: number) {
  const index = (y * width + x) * 4
  return {
    r: pixels[index] ?? 0,
    g: pixels[index + 1] ?? 0,
    b: pixels[index + 2] ?? 0,
    a: pixels[index + 3] ?? 0
  }
}

function rendered(graph: SceneGraph, node: SceneNode) {
  const page = expectDefined(graph.getPages()[0]).id
  const png = expectDefined(
    renderNodesToImage(ck, renderer, graph, page, [node.id], {
      scale: 1,
      format: 'PNG',
      trimTransparent: false
    })
  )
  const image = expectDefined(ck.MakeImageFromEncoded(png))
  try {
    const width = image.width()
    const height = image.height()
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width,
        height,
        alphaType: ck.AlphaType.Unpremul,
        colorType: ck.ColorType.RGBA_8888,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    if (!(pixels instanceof Uint8Array)) throw new Error('Expected RGBA bytes')
    return { pixels, width, height }
  } finally {
    image.delete()
  }
}

test('an inside stroke reaches the new edge after layout grows the frame', () => {
  setTextMeasurer((node) => ({ width: node.text === 'wide' ? 160 : 40, height: 24 }))
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const frame = graph.createNode('FRAME', page, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    width: 40,
    height: 24,
    fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        type: 'SOLID',
        color: { r: 0, g: 0, b: 1, a: 1 },
        opacity: 1,
        visible: true,
        weight: WEIGHT,
        align: 'INSIDE'
      }
    ],
    strokeAlign: 'INSIDE',
    strokeWeight: WEIGHT,
    strokeGeometry: [{ windingRule: 'EVENODD', commandsBlob: outlineBlob(40, 24) }]
  })
  const label = graph.createNode('TEXT', frame.id, {
    text: 'iOS',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 40,
    height: 24
  })

  computeAllLayouts(graph)
  expect(frame.width).toBe(40)
  expect(frame.strokeGeometry).not.toEqual([])

  graph.updateNode(label.id, { text: 'wide' })
  computeAllLayouts(graph)
  expect(frame.width).toBe(160)

  const { pixels, width, height } = rendered(graph, frame)
  const midY = Math.floor(height / 2)
  let minX = width
  let maxX = 0
  for (let x = 0; x < width; x++) {
    if (pixel(pixels, width, x, midY).a > 200) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
  }
  const left = pixel(pixels, width, minX + 3, midY)
  const right = pixel(pixels, width, maxX - 3, midY)
  const centre = pixel(pixels, width, Math.floor((minX + maxX) / 2), midY)

  expect(left.b).toBeGreaterThan(200)
  expect(left.r).toBeLessThan(80)
  expect(right.b).toBeGreaterThan(200)
  expect(right.r).toBeLessThan(80)
  expect(centre.r).toBeGreaterThan(200)
  expect(centre.b).toBeLessThan(80)
})
