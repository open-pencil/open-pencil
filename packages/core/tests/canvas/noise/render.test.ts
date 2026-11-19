import { afterAll, describe, expect, test } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { renderNodesToImage } from '@open-pencil/core/io/formats/raster'
import { noise } from '@open-pencil/design-jsx'
import {
  SceneGraph,
  type DocumentColorSpace,
  type Effect,
  type SceneNode
} from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { withNoiseEffects } from '#core/canvas/noise/render'
import { noiseUniforms } from '#core/canvas/noise/shader'

const ck = await getCanvasKit()
const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
afterAll(() => renderer.destroy())

const SIZE = 128

/** The red channel of a 128 px white square with `effect`, exported at 1× from a `space` document. */
function exportedRed(effect: Effect, space: DocumentColorSpace = 'srgb'): Uint8Array {
  const graph = new SceneGraph()
  graph.documentColorSpace = space
  const page = graph.getPages()[0].id
  const node = graph.createNode('RECTANGLE', page, {
    width: SIZE,
    height: SIZE,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    effects: [effect]
  })
  const png = renderNodesToImage(ck, renderer, graph, page, [node.id], { scale: 1, format: 'PNG' })
  const image = expectDefined(ck.MakeImageFromEncoded(expectDefined(png)))
  try {
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: SIZE,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    return Uint8Array.from({ length: SIZE * SIZE }, (_, i) => pixels[i * 4])
  } finally {
    image.delete()
  }
}

/** How much black noise covers each pixel, and the share of pixels it leaves uncovered. */
function coverage(red: Uint8Array) {
  let sum = 0
  let bare = 0
  for (const value of red) {
    const alpha = 1 - value / 255
    sum += alpha
    if (alpha < 1 / 32) bare += 1
  }
  return { mean: sum / red.length, bare: bare / red.length }
}

// Figma 126 exports of a black monotone noise of size 1 over 256 px of white, at 1×.
describe('noise effects drawn as Figma draws them', () => {
  test('cover as much of the layer at each density as Figma does', () => {
    const half = coverage(exportedRed(noise({ color: '#000000', noiseSize: 1, density: 0.5 })))
    expect(half.mean).toBeCloseTo(0.0897, 2)
    expect(half.bare).toBeCloseTo(0.514, 1)
    const full = coverage(exportedRed(noise({ color: '#000000', noiseSize: 1, density: 1 })))
    expect(full.mean).toBeCloseTo(0.4996, 2)
    expect(full.bare).toBeCloseTo(0.021, 2)
    expect(coverage(exportedRed(noise({ color: '#000000', density: 0 }))).mean).toBe(0)
  })

  test('lay the same grains in a Display P3 document', () => {
    // The level tiles are data: drawn into a P3 document they must not be converted as colors.
    const effect = noise({ color: '#000000', noiseSize: 1, density: 0.5 })
    const srgb = exportedRed(effect)
    const p3 = exportedRed(effect, 'display-p3')
    let worst = 0
    for (let i = 0; i < srgb.length; i++) worst = Math.max(worst, Math.abs(srgb[i] - p3[i]))
    expect(worst).toBeLessThanOrEqual(1)
  })

  test('sample once per output pixel in a supersampled export, so the grains stay sharp', () => {
    // Drawn straight onto a surface of the export's own pixels, the noise is the reference.
    const effect = noise({ color: '#000000', noiseSize: 1.5, density: 1 })
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', page, {
      width: SIZE,
      height: SIZE,
      effects: [effect]
    })
    const surface = expectDefined(ck.MakeSurface(SIZE, SIZE))
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.WHITE)
      const white = new ck.Paint()
      white.setColor(ck.WHITE)
      withNoiseEffects(renderer, canvas, node, graph, () =>
        canvas.drawRect(ck.LTRBRect(0, 0, SIZE, SIZE), white)
      )
      white.delete()
      const direct = expectDefined(
        surface.makeImageSnapshot().readPixels(0, 0, {
          width: SIZE,
          height: SIZE,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        })
      )
      const exported = exportedRed(effect)
      let same = 0
      for (let i = 0; i < exported.length; i++) if (exported[i] === direct[i * 4]) same += 1
      expect(same / exported.length).toBeGreaterThan(0.99)
    } finally {
      surface.delete()
    }
  })

  test('grain only what the layer draws, as much as it covers each pixel', () => {
    const red = noise({ color: '#ff0000', noiseSize: 1, density: 1 })
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', page, {
      width: SIZE,
      height: SIZE,
      fills: [],
      effects: [red]
    })
    graph.createNode('RECTANGLE', frame.id, {
      width: SIZE / 2,
      height: SIZE,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 0.5, visible: true }]
    })
    const png = renderNodesToImage(ck, renderer, graph, page, [frame.id], {
      scale: 1,
      format: 'PNG'
    })
    const image = expectDefined(ck.MakeImageFromEncoded(expectDefined(png)))
    const pixels = expectDefined(
      image.readPixels(0, 0, {
        width: SIZE,
        height: SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Premul,
        colorSpace: ck.ColorSpace.SRGB
      })
    )
    image.delete()
    let gapAlpha = 0
    let maxAlpha = 0
    let maxRed = 0
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const at = (y * SIZE + x) * 4
        if (x >= SIZE / 2) gapAlpha = Math.max(gapAlpha, pixels[at + 3])
        else {
          maxAlpha = Math.max(maxAlpha, pixels[at + 3])
          maxRed = Math.max(maxRed, pixels[at])
        }
      }
    }
    // Nothing in the frame's empty half; over the half-covering child, the noise at half strength:
    // red r·0.5 over 50% black reaches 0.5 red and 0.75 alpha at most.
    expect(gapAlpha).toBe(0)
    expect(maxRed).toBeGreaterThan(100)
    expect(maxRed).toBeLessThanOrEqual(128)
    expect(maxAlpha).toBeLessThanOrEqual(192)
  })

  test('grain a frame’s own fill once, as a shape’s', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const props = {
      width: SIZE,
      height: SIZE,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [noise({ color: '#00000080', noiseSize: 1, density: 1 })]
    } satisfies Partial<SceneNode>
    const frame = graph.createNode('FRAME', page, props)
    const rect = graph.createNode('RECTANGLE', page, { ...props, x: SIZE * 2 })
    const exported = (id: string) =>
      renderNodesToImage(ck, renderer, graph, page, [id], { scale: 1, format: 'PNG' })
    expect(exported(frame.id)).toEqual(exported(rect.id))
  })

  test('draw nothing at no density, a duotone’s second colour included', () => {
    const none = noise({
      noiseType: 'DUOTONE',
      color: '#000000',
      secondaryColor: '#000000',
      density: 0
    })
    expect(coverage(exportedRed(none)).mean).toBe(0)
  })

  test('a duotone splits each pixel between its two colours at full density', () => {
    const shares = noiseUniforms(
      noise({ noiseType: 'DUOTONE', color: '#ff0000', secondaryColor: '#0000ff', density: 1 })
    )
    expect(shares.mode).toBe(1)
    expect(shares.secondary).toEqual([0, 0, 1, 1])
  })

  test('a grain wider than tall keeps both of its sizes', () => {
    const wide = noiseUniforms(noise({ noiseSize: { x: 16, y: 1 } }))
    const tall = noiseUniforms(noise({ noiseSize: { x: 1, y: 16 } }))
    expect(wide.cell[0]).toBeGreaterThan(wide.cell[1])
    expect(tall.cell[1]).toBeGreaterThan(tall.cell[0])
  })

  test('an export after another at a different scale draws its own pixel grid', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const node = graph.createNode('RECTANGLE', page, {
      width: 64,
      height: 64,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      effects: [noise({ color: '#000000', noiseSize: 1.5, density: 1 })]
    })
    const exported = (with_: SkiaRenderer, scale: number) =>
      expectDefined(renderNodesToImage(ck, with_, graph, page, [node.id], { scale, format: 'PNG' }))
    exported(renderer, 1)
    const fresh = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(1, 1)))
    try {
      expect(exported(renderer, 2)).toEqual(exported(fresh, 2))
    } finally {
      fresh.destroy()
    }
  })
})
