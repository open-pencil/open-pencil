import { beforeAll, describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'
import { toUint8Array } from 'js-base64'

import { SkiaRenderer } from '@lawha/core/canvas'
import { renderNodesToImage } from '@lawha/core/io/formats/raster'
import { SceneGraph, type ImageAdjustments } from '@lawha/scene-graph'
import { computeImageHash } from '@lawha/scene-graph/images'

import {
  adjustmentUniforms,
  CURVE_SAMPLES,
  hasAdjustments,
  sampleCurve
} from '#core/canvas/image-adjust'
import { getCanvasKit } from '#core/canvaskit'

let ck: CanvasKit

beforeAll(async () => {
  ck = await getCanvasKit()
})

/** A PNG filled with one sRGB colour, 0–255 per channel. */
function swatch(r: number, g: number, b: number): Uint8Array {
  const surface = ck.MakeSurface(8, 8)
  if (!surface) throw new Error('no surface')
  surface.getCanvas().clear(ck.Color(r, g, b, 1))
  const image = surface.makeImageSnapshot()
  const bytes = image.encodeToBytes(ck.ImageFormat.PNG, 100)
  image.delete()
  surface.delete()
  if (!bytes) throw new Error('encode failed')
  return bytes
}

/** Renders a rectangle filled with the swatch and the adjustments, and reads its centre pixel. */
function render(
  rgb: [number, number, number],
  adjustments?: ImageAdjustments
): [number, number, number] {
  const graph = new SceneGraph()
  const bytes = swatch(...rgb)
  const hash = computeImageHash(bytes)
  graph.images.set(hash, bytes)
  const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    width: 16,
    height: 16,
    fills: [
      {
        type: 'IMAGE',
        imageHash: hash,
        imageScaleMode: 'FILL',
        opacity: 1,
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 1 },
        adjustments
      }
    ]
  })
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('no surface')
  const renderer = new SkiaRenderer(ck, surface)
  const png = renderNodesToImage(ck, renderer, graph, graph.getPages()[0].id, [node.id], {
    scale: 1,
    format: 'PNG'
  })
  if (!png) throw new Error('nothing rendered')
  const image = ck.MakeImageFromEncoded(png)
  if (!image) throw new Error('decode failed')
  const pixels = image.readPixels(8, 8, {
    width: 1,
    height: 1,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB
  })
  image.delete()
  surface.delete()
  if (!pixels) throw new Error('read failed')
  return [pixels[0], pixels[1], pixels[2]]
}

const near = (a: number, b: number, tolerance = 2) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tolerance)

describe('adjustment values', () => {
  test('zero or missing adjustments are skipped', () => {
    expect(hasAdjustments(undefined)).toBe(false)
    expect(hasAdjustments({})).toBe(false)
    expect(hasAdjustments({ exposure: 0, contrast: 0 })).toBe(false)
    expect(hasAdjustments({ contrast: 0.2 })).toBe(true)
    expect(hasAdjustments({ invert: true })).toBe(true)
  })

  test('uniforms follow the declared order and are clamped to -1…1', () => {
    const u = adjustmentUniforms({ exposure: 3, hue: -2, invert: true })
    expect(u.slice(0, 18)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 1, 0, 1, 1, 0])
    expect(u).toHaveLength(18 + CURVE_SAMPLES + 2)
  })
})

describe('filters', () => {
  test('noise varies neighbouring pixels of a flat image', () => {
    const graph = new SceneGraph()
    const bytes = swatch(128, 128, 128)
    const hash = computeImageHash(bytes)
    graph.images.set(hash, bytes)
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      width: 16,
      height: 16,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FILL',
          opacity: 1,
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          adjustments: { noise: 1 }
        }
      ]
    })
    const surface = ck.MakeSurface(1, 1)
    if (!surface) throw new Error('no surface')
    const png = renderNodesToImage(
      ck,
      new SkiaRenderer(ck, surface),
      graph,
      graph.getPages()[0].id,
      [node.id],
      { scale: 1, format: 'PNG' }
    )
    if (!png) throw new Error('nothing rendered')
    const image = ck.MakeImageFromEncoded(png)
    if (!image) throw new Error('decode failed')
    const px = image.readPixels(0, 0, {
      width: 16,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    surface.delete()
    if (!px) throw new Error('read failed')
    const reds = new Set<number>()
    for (let i = 0; i < 16; i++) reds.add(px[i * 4])
    expect(reds.size).toBeGreaterThan(4)
  })

  test('sharpen leaves a flat area unchanged', () => {
    const [r, g, b] = render([180, 100, 60], { sharpen: 1 })
    near(r, 180, 2)
    near(g, 100, 2)
    near(b, 60, 2)
  })

  test('a positive vignette leaves the centre nearly as it was', () => {
    near(render([200, 200, 200], { vignette: 1 })[0], 200, 6)
  })
})

describe('levels and curves', () => {
  test('identity levels and a straight curve change nothing', () => {
    expect(hasAdjustments({ levels: { black: 0, white: 1, gamma: 1 } })).toBe(false)
    expect(
      hasAdjustments({
        curve: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ]
      })
    ).toBe(false)
    expect(hasAdjustments({ levels: { black: 0.1, white: 1, gamma: 1 } })).toBe(true)
    expect(hasAdjustments({ curve: [{ x: 0.5, y: 0.7 }] })).toBe(true)
  })

  test('a sampled curve passes through its points and never overshoots', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.1 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 1 }
    ]
    const s = sampleCurve(points)
    expect(s).toHaveLength(CURVE_SAMPLES)
    expect(s[0]).toBeCloseTo(0)
    expect(s[(CURVE_SAMPLES - 1) / 4]).toBeCloseTo(0.1)
    expect(s[CURVE_SAMPLES - 1]).toBeCloseTo(1)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1] - 1e-9)
  })

  test('the curve is flat outside its first and last point', () => {
    const s = sampleCurve([
      { x: 0.25, y: 0.3 },
      { x: 0.75, y: 0.6 }
    ])
    expect(s[0]).toBeCloseTo(0.3)
    expect(s[CURVE_SAMPLES - 1]).toBeCloseTo(0.6)
  })

  test('levels: pixels at the black point become black, at the white point white', () => {
    const levels = { black: 100 / 255, white: 200 / 255, gamma: 1 }
    near(render([100, 100, 100], { levels })[0], 0, 2)
    near(render([200, 200, 200], { levels })[0], 255, 2)
    near(render([150, 150, 150], { levels })[0], 128, 3)
  })

  test('levels gamma above 1 lightens midtones', () => {
    const mid = render([128, 128, 128], { levels: { black: 0, white: 1, gamma: 2 } })[0]
    expect(mid).toBeGreaterThan(160)
  })

  test('a raised curve lightens; an inverted curve negates', () => {
    expect(
      render([128, 128, 128], {
        curve: [
          { x: 0, y: 0 },
          { x: 0.5, y: 0.75 },
          { x: 1, y: 1 }
        ]
      })[0]
    ).toBeGreaterThan(175)
    const [r] = render([60, 60, 60], {
      curve: [
        { x: 0, y: 1 },
        { x: 1, y: 0 }
      ]
    })
    near(r, 195, 3)
  })
})

describe('rendered adjustments', () => {
  const base: [number, number, number] = [180, 100, 60]

  test('no adjustments draw the image exactly', () => {
    const [r, g, b] = render(base)
    near(r, 180, 1)
    near(g, 100, 1)
    near(b, 60, 1)
  })

  test('all-zero adjustments are identical to none', () => {
    expect(render(base, { exposure: 0, saturation: 0, hue: 0 })).toEqual(render(base))
  })

  test('saturation -1 is grey: every channel equal', () => {
    const [r, g, b] = render(base, { saturation: -1 })
    near(r, g, 1)
    near(g, b, 1)
  })

  test('invert flips every channel', () => {
    const [r, g, b] = render(base, { invert: true })
    near(r, 255 - 180, 2)
    near(g, 255 - 100, 2)
    near(b, 255 - 60, 2)
  })

  test('exposure brightens and darkens', () => {
    const plain = render([100, 100, 100])
    expect(render([100, 100, 100], { exposure: 0.5 })[0]).toBeGreaterThan(plain[0] + 20)
    expect(render([100, 100, 100], { exposure: -0.5 })[0]).toBeLessThan(plain[0] - 20)
  })

  test('contrast pushes values away from mid-grey', () => {
    const dark = render([60, 60, 60], { contrast: 0.5 })
    const light = render([200, 200, 200], { contrast: 0.5 })
    expect(dark[0]).toBeLessThan(60)
    expect(light[0]).toBeGreaterThan(200)
  })

  test('temperature warms (red up, blue down) and cools', () => {
    const grey: [number, number, number] = [128, 128, 128]
    const [wr, , wb] = render(grey, { temperature: 0.5 })
    expect(wr).toBeGreaterThan(wb + 10)
    const [cr, , cb] = render(grey, { temperature: -0.5 })
    expect(cb).toBeGreaterThan(cr + 10)
  })

  test('tint moves between green and magenta', () => {
    const grey: [number, number, number] = [128, 128, 128]
    const magenta = render(grey, { tint: 0.5 })
    expect(magenta[0]).toBeGreaterThan(magenta[1])
    const green = render(grey, { tint: -0.5 })
    expect(green[1]).toBeGreaterThan(green[0])
  })

  test('shadows lift darks more than lights; highlights the opposite', () => {
    const lift = (rgb: [number, number, number], adj: ImageAdjustments) =>
      render(rgb, adj)[0] - render(rgb)[0]
    expect(lift([40, 40, 40], { shadows: 0.6 })).toBeGreaterThan(
      lift([220, 220, 220], { shadows: 0.6 })
    )
    expect(lift([200, 200, 200], { highlights: -0.6 })).toBeLessThan(
      lift([40, 40, 40], { highlights: -0.6 })
    )
  })

  test('hue rotation by half a turn swaps a red for a cyan-ish colour, keeping grey grey', () => {
    const [r, g, b] = render([200, 40, 40], { hue: 1 })
    expect(g).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(r)
    const [gr, gg, gb] = render([128, 128, 128], { hue: 0.4 })
    near(gr, gg, 2)
    near(gg, gb, 2)
  })

  test('vibrance boosts dull colours more than saturated ones', () => {
    const spread = ([r, g, b]: [number, number, number]) => Math.max(r, g, b) - Math.min(r, g, b)
    const dull: [number, number, number] = [140, 120, 110]
    const vivid: [number, number, number] = [230, 30, 30]
    const dullGain = spread(render(dull, { vibrance: 0.8 })) / spread(render(dull))
    const vividGain = spread(render(vivid, { vibrance: 0.8 })) / spread(render(vivid))
    expect(dullGain).toBeGreaterThan(vividGain)
  })
})

describe('SVG and PDF export bake adjustments into the embedded image', () => {
  async function svgImage(
    adjustments?: ImageAdjustments
  ): Promise<{ bytes: Uint8Array; original: Uint8Array }> {
    const { renderNodesToLaidOutSVG } = await import('#core/io/formats/svg/text/layout')
    const graph = new SceneGraph()
    const original = swatch(180, 100, 60)
    const hash = computeImageHash(original)
    graph.images.set(hash, original)
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      width: 16,
      height: 16,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FILL',
          opacity: 1,
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 1 },
          adjustments
        }
      ]
    })
    const svg = await renderNodesToLaidOutSVG(graph, graph.getPages()[0].id, [node.id])
    const match = svg?.match(/href="data:image\/png;base64,([^"]+)"/)
    if (!match) throw new Error('no embedded image')
    return { bytes: toUint8Array(match[1]), original }
  }

  function centre(bytes: Uint8Array): [number, number, number] {
    const image = ck.MakeImageFromEncoded(bytes)
    if (!image) throw new Error('decode failed')
    const px = image.readPixels(4, 4, {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    })
    image.delete()
    if (!px) throw new Error('read failed')
    return [px[0], px[1], px[2]]
  }

  test('an unadjusted image is embedded byte for byte', async () => {
    const { bytes, original } = await svgImage()
    expect(bytes).toEqual(original)
  })

  test('an adjusted image is embedded with the same colour the canvas draws', async () => {
    const adjust: ImageAdjustments = { saturation: -0.6, exposure: 0.3, hue: 0.2 }
    const { bytes } = await svgImage(adjust)
    const exported = centre(bytes)
    const canvas = render([180, 100, 60], adjust)
    for (let i = 0; i < 3; i++) near(exported[i], canvas[i], 2)
    expect(exported).not.toEqual([180, 100, 60])
  })
})
