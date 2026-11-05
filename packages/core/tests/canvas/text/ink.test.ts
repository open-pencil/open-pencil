import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import type { VisualBounds } from '@open-pencil/scene-graph/geometry'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'
import { expectDefined } from '@open-pencil/test-support/assert'

import { textVerticalOffset } from '#core/canvas/text'
import { textInkBounds } from '#core/canvas/text/ink'
import { buildParagraph } from '#core/canvas/text/layout/build'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/font/manager'
import { withTextInkMeasurer } from '#core/text/ink'

let ck: CanvasKit
let provider: TypefaceFontProvider

beforeAll(async () => {
  ck = await getCanvasKit()
  provider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, provider)
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
    'bundled Inter font'
  )
  provider.registerFont(inter, 'Inter')
  await fontManager.markLoaded('Inter', 'Regular', inter)
})

afterAll(() => {
  fontManager.detachProvider(provider)
  provider.delete()
})

function ink(node: SceneNode): VisualBounds | null | undefined {
  const layout = buildParagraph(
    { ck, fontProvider: provider, fontsLoaded: true },
    node,
    undefined,
    {
      halfLeading: true
    }
  )
  try {
    return textInkBounds(node, layout, textVerticalOffset(node, layout.getHeight()))
  } finally {
    layout.delete()
  }
}

function textNode(props: Partial<SceneNode>): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 24,
    lineHeight: null,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 200,
    height: 100,
    ...props
  })
}

function rect(bounds: VisualBounds | null | undefined): number[] {
  const { minX, minY, maxX, maxY } = expectDefined(bounds, 'ink bounds')
  return [minX, minY, maxX - minX, maxY - minY]
}

/**
 * Figma desktop 126 draws Inter 3.19, OpenPencil the Inter 4 it bundles: outlines that sit
 * within a fraction of a pixel vertically and differ by up to a pixel in width.
 */
function expectFigmaRect(ours: number[], figma: number[]): void {
  const [x, y, width, height] = ours
  expect(Math.abs(x - figma[0])).toBeLessThan(0.3)
  expect(Math.abs(y - figma[1])).toBeLessThan(0.1)
  expect(Math.abs(width - figma[2])).toBeLessThan(1)
  expect(Math.abs(height - figma[3])).toBeLessThan(0.1)
}

// Figma desktop 126 (2026-11-05), 24 px Inter: absoluteRenderBounds against the text's box.
describe('text ink', () => {
  test('takes the glyph outlines on the whole pixel their baseline is drawn on', () => {
    expectFigmaRect(rect(ink(textNode({ text: 'H' }))), [2.114, 5.545, 13.534, 17.455])
    // A space draws no ink.
    expectFigmaRect(rect(ink(textNode({ text: 'H   ' }))), [2.114, 5.545, 13.534, 17.455])
    expectFigmaRect(rect(ink(textNode({ text: 'Hgy\nHgy' }))), [2.114, 5.545, 42.822, 51.636])
  })

  test('reaches past a box the lines are taller than', () => {
    const zero = ink(textNode({ text: 'Hgy\nHgy', lineHeight: pixelLength(0) }))
    expectFigmaRect(rect(zero), [2.114, -8.455, 42.822, 22.636])
    const half = ink(textNode({ text: 'Hgy\nHgy', lineHeight: percentLength(50) }))
    expectFigmaRect(rect(half), [2.114, -2.455, 42.822, 34.636])
  })

  test('rounds a baseline set in a box by its alignment', () => {
    const centred = textNode({
      text: 'H',
      textAutoResize: 'NONE',
      width: 100,
      height: 60,
      textAlignHorizontal: 'CENTER',
      textAlignVertical: 'CENTER'
    })
    expectFigmaRect(rect(ink(centred)), [43.231, 21.545, 13.534, 17.455])
  })

  test('draws the baseline on the whole pixel its alignment rounds it to', () => {
    // Centred in 60 px, the 29 px line stands 15.5 px down, its baseline at 38.72: on 39.
    const node = textNode({
      text: 'H',
      textAutoResize: 'NONE',
      width: 100,
      height: 60,
      textAlignVertical: 'CENTER'
    })
    const layout = buildParagraph(
      { ck, fontProvider: provider, fontsLoaded: true },
      node,
      undefined,
      {
        halfLeading: true
      }
    )
    // At 4 device pixels to the pixel, 38.5 and 39 lie two device rows apart.
    const scale = 4
    const [width, height] = [100 * scale, 60 * scale]
    const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
    try {
      const canvas = surface.getCanvas()
      canvas.clear(ck.WHITE)
      canvas.scale(scale, scale)
      layout.draw(canvas, 0, textVerticalOffset(node, layout.getHeight()))
      const pixels = expectDefined(
        canvas.readPixels(0, 0, {
          width,
          height,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Unpremul,
          colorSpace: ck.ColorSpace.SRGB
        }),
        'pixels'
      )
      const inked = (y: number) =>
        Array.from({ length: width }, (_, x) => pixels[(y * width + x) * 4]).some(
          (red) => red < 128
        )
      const rows = Array.from({ length: height }, (_, y) => y).filter(inked)
      expect((expectDefined(rows.at(-1), 'ink') + 1) / scale).toBe(39)
    } finally {
      surface.delete()
      layout.delete()
    }
  })

  test('takes in an underline across the line', () => {
    const underlined = rect(ink(textNode({ text: 'Hgy', textDecoration: 'UNDERLINE' })))
    expect(underlined[0]).toBe(0)
    expect(underlined[1]).toBeCloseTo(5.545, 1)
  })

  test('takes in the stroke a wavy underline draws past its crests', () => {
    const underline = (textDecorationStyle: 'SOLID' | 'WAVY') =>
      rect(ink(textNode({ text: 'HH', textDecoration: 'UNDERLINE', textDecorationStyle })))
    const [, solidTop, , solidHeight] = underline('SOLID')
    const [, wavyTop, , wavyHeight] = underline('WAVY')
    expect(wavyTop).toBeCloseTo(solidTop, 3)
    expect(wavyTop + wavyHeight).toBeGreaterThan(solidTop + solidHeight)
  })

  test('takes in the frame a keycap draws around its character', () => {
    const [x, y, width, height] = rect(ink(textNode({ text: '1\u20E3' })))
    const [, , digitWidth, digitHeight] = rect(ink(textNode({ text: '1' })))
    expect(width).toBeGreaterThan(digitWidth + 4)
    expect(height).toBeGreaterThan(digitHeight)
    expect(x).toBeLessThan(2)
    expect(y).toBeLessThan(5.5)
  })

  test('is null for text that draws nothing', () => {
    expect(ink(textNode({ text: '   ' }))).toBeNull()
  })

  test('sizes render bounds with strokes and shadows grown from the ink', () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const measure = (node: SceneNode) => ink(node)
    const relative = (text: ReturnType<FigmaAPI['createText']>) => {
      const box = text.absoluteBoundingBox
      const bounds = expectDefined(
        withTextInkMeasurer(measure, () => text.absoluteRenderBounds),
        'render bounds'
      )
      return [bounds.x - box.x, bounds.y - box.y, bounds.width, bounds.height]
    }
    const stroked = api.createText()
    stroked.fontSize = 24
    stroked.characters = 'H'
    stroked.strokes = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
    stroked.strokeWeight = 4
    stroked.strokeAlign = 'OUTSIDE'
    expectFigmaRect(relative(stroked), [-1.886, 1.545, 21.534, 25.455])

    const shadowed = api.createText()
    shadowed.fontSize = 24
    shadowed.characters = 'H'
    shadowed.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.5 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]
    expectFigmaRect(relative(shadowed), [-5.886, 1.545, 29.534, 33.455])
  })
})
