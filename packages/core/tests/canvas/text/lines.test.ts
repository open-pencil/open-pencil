import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode, type StyleRun } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import type { TextLayout } from '#core/canvas/text/layout'
import { buildParagraph } from '#core/canvas/text/layout/build'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/font/manager'

const run = (start: number, length: number, style: StyleRun['style']): StyleRun => ({
  start,
  length,
  style
})

let ck: CanvasKit
let provider: TypefaceFontProvider

function layOut(props: Partial<SceneNode>): TextLayout {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 24,
    lineHeight: null,
    width: 400,
    height: 400,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props
  })
  return buildParagraph({ ck, fontProvider: provider, fontsLoaded: true }, node, undefined, {
    halfLeading: true
  })
}

function expectBaselines(layout: TextLayout, figma: number[]): void {
  const baselines = layout.getLineMetrics().map((line) => line.baseline)
  expect(baselines).toHaveLength(figma.length)
  for (const [index, baseline] of baselines.entries()) {
    expect(Math.abs(baseline - figma[index])).toBeLessThan(0.01)
  }
}

const SURFACE_WIDTH = 400

/** Whether each pixel is ink, drawing the layout at scale 1, by row. */
function inkRows(layout: TextLayout): boolean[][] {
  const height = Math.ceil(layout.getHeight()) + 20
  const surface = expectDefined(ck.MakeSurface(SURFACE_WIDTH, height), 'surface')
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    layout.draw(canvas, 0, 0)
    const pixels = expectDefined(
      canvas.readPixels(0, 0, {
        width: SURFACE_WIDTH,
        height,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    return Array.from({ length: height }, (_, y) =>
      Array.from({ length: SURFACE_WIDTH }, (_, x) => pixels[(y * SURFACE_WIDTH + x) * 4] < 128)
    )
  } finally {
    surface.delete()
  }
}

/** The lowest row with ink between `left` and `right`. */
function lowestInk(layout: TextLayout, left: number, right: number): number {
  return inkRows(layout).findLastIndex((row) => row.slice(left, right).includes(true))
}

/** The rightmost column with ink between rows `top` and `bottom`. */
function rightmostInk(layout: TextLayout, top: number, bottom: number): number {
  return Math.max(
    ...inkRows(layout)
      .slice(top, bottom)
      .map((row) => row.lastIndexOf(true))
  )
}

// Baselines and heights measured in live Figma (2026-10-11) from the lines it saves, Inter.
describe('lines of mixed sizes', () => {
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

  test('steps each baseline down by the height of the line it starts', () => {
    const below = layOut({
      text: 'first line\nSmall LARGE',
      styleRuns: [run(17, 5, { fontSize: 40 })]
    })
    expectBaselines(below, [23.227, 71.227])
    expect(Math.ceil(below.getHeight())).toBe(81)

    const above = layOut({
      text: 'Small LARGE\nsecond line',
      styleRuns: [run(6, 5, { fontSize: 40 })]
    })
    expectBaselines(above, [38.545, 67.545])
    expect(Math.ceil(above.getHeight())).toBe(74)
  })

  test('gives a line the tallest line height on it, wrapped lines too', () => {
    const fixed = layOut({
      text: 'one\ntwo\nthree',
      styleRuns: [run(4, 3, { lineHeight: pixelLength(50) })]
    })
    expectBaselines(fixed, [23.227, 73.227, 102.227])
    expect(Math.ceil(fixed.getHeight())).toBe(108)

    const wrapped = layOut({
      text: 'small words LARGE then wraps to more lines here',
      width: 160,
      textAutoResize: 'HEIGHT',
      styleRuns: [run(12, 5, { fontSize: 40 })]
    })
    expectBaselines(wrapped, [23.227, 71.227, 100.227, 129.227, 158.227])
  })

  test('stretches justified lines where they are placed', () => {
    const layout = layOut({
      text: 'small words LARGE then wraps to more lines here',
      width: 160,
      textAutoResize: 'HEIGHT',
      textAlignHorizontal: 'JUSTIFIED',
      styleRuns: [run(12, 5, { fontSize: 40 })]
    })
    expectBaselines(layout, [23.227, 71.227, 100.227, 129.227, 158.227])
    // The line after "LARGE", which stands alone on its line, has words to stretch between.
    const third = layout.getLineMetrics()[2]
    const right = rightmostInk(layout, Math.ceil(third.baseline) - 10, Math.ceil(third.baseline))
    expect(right).toBeGreaterThan(155)
  })

  test('centres the tallest font of a line in its line height', () => {
    const layout = layOut({
      text: 'Small LARGE\nsecond',
      lineHeight: pixelLength(30),
      styleRuns: [run(6, 5, { fontSize: 40 })]
    })
    expectBaselines(layout, [29.545, 59.545])
    expect(Math.ceil(layout.getHeight())).toBe(66)
  })

  test('adds paragraph spacing, and sizes an empty line by its newline', () => {
    const spaced = layOut({
      text: 'one\ntwo BIG\nthree',
      paragraphSpacing: 10,
      styleRuns: [run(8, 3, { fontSize: 40 })]
    })
    expectBaselines(spaced, [23.227, 81.227, 120.227])
    expect(Math.ceil(spaced.getHeight())).toBe(126)

    const empty = layOut({ text: 'one\n\nthree', styleRuns: [run(4, 1, { fontSize: 40 })] })
    expectBaselines(empty, [23.227, 71.227, 100.227])
    expect(Math.ceil(empty.getHeight())).toBe(106)
  })

  test('draws, selects, and hits each line where it is placed', () => {
    const layout = layOut({
      text: 'first line\nSmall LARGE',
      styleRuns: [run(17, 5, { fontSize: 40 })]
    })
    const baseline = layout.getLineMetrics()[1].baseline
    const [rect] = layout.getRectsForRange(
      17,
      22,
      ck.RectHeightStyle.Tight,
      ck.RectWidthStyle.Tight
    )
    expect(rect.rect[1]).toBeLessThan(baseline)
    expect(rect.rect[3]).toBeGreaterThan(baseline)
    const caret = expectDefined(layout.getCaretRect(19, false), 'caret')
    expect(caret.top).toBeLessThan(baseline)
    expect(caret.bottom).toBeGreaterThan(baseline)
    expect(layout.getGlyphPositionAtCoordinate(rect.rect[0] + 1, baseline - 10).pos).toBe(17)

    // "LARGE" has no descenders: its ink ends on the baseline.
    const ink = lowestInk(layout, Math.ceil(rect.rect[0]), Math.floor(rect.rect[2]))
    expect(Math.abs(ink + 1 - baseline)).toBeLessThan(1)
    for (const line of layout.getShapedLines()) {
      for (const glyphRun of line.runs) {
        expect(Math.abs(glyphRun.positions[1] - line.baseline)).toBeLessThan(1)
      }
    }
  })

  test('fits the number of lines whose individual heights fit the box', () => {
    const smaller = layOut({
      text: 'small\nsmall\nsmall',
      fontSize: 40,
      height: 34,
      textAutoResize: 'NONE',
      textTruncation: 'ENDING',
      styleRuns: [run(0, 17, { fontSize: 12 })]
    })
    expect(smaller.getLineMetrics()).toHaveLength(2)
    expect(smaller.didExceedMaxLines()).toBe(true)

    const larger = layOut({
      text: 'small\nLARGE\nsmall',
      height: 70,
      textAutoResize: 'NONE',
      textTruncation: 'ENDING',
      styleRuns: [run(6, 5, { fontSize: 40 })]
    })
    expect(larger.getLineMetrics()).toHaveLength(1)
    expect(larger.didExceedMaxLines()).toBe(true)
  })
})
