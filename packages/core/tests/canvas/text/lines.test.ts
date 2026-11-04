import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '@open-pencil/test-support/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode, type StyleRun } from '@open-pencil/scene-graph'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

import type { TextLayout } from '#core/canvas/text/layout'
import { buildParagraph } from '#core/canvas/text/layout/build'
import { getCanvasKit } from '#core/canvaskit'
import { estimateTextSize } from '#core/layout/text-measurement'
import { fontManager } from '#core/text/font/manager'

const run = (start: number, length: number, style: StyleRun['style']): StyleRun => ({
  start,
  length,
  style
})

let ck: CanvasKit
let provider: TypefaceFontProvider

function layOut(props: Partial<SceneNode>): TextLayout {
  return buildParagraph(
    { ck, fontProvider: provider, fontsLoaded: true },
    textNode(props),
    undefined,
    {
      halfLeading: true
    }
  )
}

function textNode(props: Partial<SceneNode>): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 24,
    lineHeight: null,
    width: 400,
    height: 400,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props
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

// Baselines and heights measured in live Figma (2026-10-11) from the lines it saves, Inter.
describe('lines of mixed sizes', () => {
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

  // Typing Enter at the end grows the box at once, and the caret starts the new line.
  test('counts the empty line a closing newline makes', () => {
    const closed = layOut({ text: 'abc\n' })
    const open = layOut({ text: 'abc\nx' })
    expect(Math.ceil(closed.getHeight())).toBe(Math.ceil(open.getHeight()))
    const caret = expectDefined(closed.getCaretRect(4, false), 'caret after the newline')
    const lineTwo = expectDefined(open.getCaretRect(4, false), 'caret before x')
    expect(caret.x).toBe(lineTwo.x)
    expect(caret.top).toBeCloseTo(lineTwo.top, 2)
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

/** Each line's baseline below the first. */
function baselineSteps(layout: TextLayout): number[] {
  const [first, ...rest] = layout.getLineMetrics().map((line) => line.baseline)
  return [0, ...rest.map((baseline) => Math.round((baseline - first) * 1000) / 1000)]
}

/** The bottom row of each run of rows with ink, drawing the layout at scale 1. */
function inkBottoms(layout: TextLayout): number[] {
  const rows = inkRows(layout).map((row) => row.includes(true))
  return rows.flatMap((inked, y) => (inked && !rows[y + 1] ? [y] : []))
}

// Figma desktop 126 (2026-11-04), Inter: lines step by an exact line height in pixels and each
// baseline lands on a whole pixel; a percent line height is whole pixels to begin with.
describe('fractional line heights', () => {
  const lines = (count: number) => Array.from({ length: count }, () => 'H').join('\n')

  // Figma saves the exact steps and draws each baseline on a whole pixel.
  const fractional = [
    [23, 30.6, [0, 30, 61, 91], 123],
    [23, 25.3, [0, 25, 51, 76], 102],
    [17, 22.7, [0, 22, 45, 68], 91],
    [17, 20.45, [0, 21, 41, 62], 82]
  ] as const

  test('step lines by an exact line height in pixels', () => {
    for (const [fontSize, lineHeight, , height] of fractional) {
      const layout = layOut({ text: lines(4), fontSize, lineHeight: pixelLength(lineHeight) })
      const steps = [0, 1, 2, 3].map((line) => Math.round(line * lineHeight * 1000) / 1000)
      expect(baselineSteps(layout)).toEqual(steps)
      expect(Math.ceil(layout.getHeight())).toBe(height)
      layout.delete()
    }
  })

  test('draw each line on the whole pixel its baseline rounds to', () => {
    for (const [fontSize, lineHeight, drawn] of fractional) {
      const layout = layOut({ text: lines(4), fontSize, lineHeight: pixelLength(lineHeight) })
      const bottoms = inkBottoms(layout)
      expect(bottoms.map((bottom) => bottom - bottoms[0])).toEqual([...drawn])
      const first = layout.getLineMetrics()[0].baseline
      expect(bottoms[0] + 1).toBe(Math.round(first))
      layout.delete()
    }
  })

  // Figma desktop 126 (2026-11-04), 14 px Inter: the baselines it saves and the height it gives.
  test('set lines on top of each other at a line height of zero', () => {
    for (const lineHeight of [pixelLength(0), percentLength(2)]) {
      for (const text of [lines(3), 'H\n\nH', 'H']) {
        const layout = layOut({ text, fontSize: 14, lineHeight })
        expectBaselines(layout, text === 'H' ? [5.091] : [5.091, 5.091, 5.091])
        expect(layout.getHeight()).toBe(0)
        // Lines on one baseline keep their own glyphs, and an empty line has none.
        const runs = layout.getShapedLines().map((line) => line.runs.length)
        expect(runs).toEqual(text === 'H\n\nH' ? [1, 0, 1] : runs.map(() => 1))
        layout.delete()
      }
    }
  })

  test('step lines by a line height under a pixel', () => {
    const layout = layOut({ text: lines(3), fontSize: 14, lineHeight: pixelLength(0.3) })
    expectBaselines(layout, [5.241, 5.541, 5.841])
    expect(Math.ceil(layout.getHeight())).toBe(1)
    layout.delete()
  })

  test('make a single line as tall as an exact line height in pixels', () => {
    // Figma rounds the height up: 11.25 px is 12 px tall.
    const layout = layOut({ text: 'H', fontSize: 9, lineHeight: pixelLength(11.25) })
    expect(layout.getHeight()).toBe(11.25)
    expect(Math.ceil(layout.getHeight())).toBe(12)
    layout.delete()
  })

  test('step lines by no pixels at a percent line height under half a pixel', () => {
    // A larger character sets its line apart from the others; Figma still makes it 1 px tall.
    const layout = layOut({
      text: 'H\nHH\nH',
      fontSize: 14,
      lineHeight: percentLength(2),
      styleRuns: [run(3, 1, { fontSize: 30 })]
    })
    expect(Math.ceil(layout.getHeight())).toBe(1)
    layout.delete()
  })

  test('round a percent line height to whole pixels', () => {
    for (const [fontSize, percent, height] of [
      [13, 110, 140],
      [14, 120, 170],
      [12, 130, 160]
    ] as const) {
      const props = { text: lines(10), fontSize, lineHeight: percentLength(percent) }
      const layout = layOut(props)
      expect(Math.ceil(layout.getHeight())).toBe(height)
      layout.delete()
      expect(estimateTextSize(textNode({ ...props, text: 'H' })).height).toBe(height / 10)
    }
  })
})

// Figma desktop 126 (2026-11-04), Inter: the baselines it saves for a text (derivedTextData) and
// the whole pixels it draws them on.
describe('baselines as Figma saves and draws them', () => {
  const cases = [
    {
      fontSize: 23,
      lineHeight: null,
      saved: [22.364, 50.364, 78.364, 106.364],
      drawn: [22, 50, 78, 106]
    },
    {
      fontSize: 23,
      lineHeight: 30.6,
      saved: [23.664, 54.264, 84.864, 115.464],
      drawn: [24, 54, 85, 115]
    },
    {
      fontSize: 23,
      lineHeight: 30,
      paragraphSpacing: 10.5,
      saved: [23.364, 63.864, 104.364, 144.864],
      drawn: [23, 64, 104, 145]
    },
    { fontSize: 16, lineHeight: 24, saved: [17.818], drawn: [18] }
  ]

  test('draws each line of mixed sizes on the whole pixel its baseline rounds to', () => {
    // The paragraph draws a larger line's glyphs on a pixel other than its baseline rounds to.
    for (const [text, styleRuns] of [
      ['HH\nHHH\nHH', [run(3, 3, { fontSize: 40 })]],
      ['H\nHH\nH', [run(2, 2, { fontSize: 31 })]]
    ] as const) {
      const layout = layOut({ text, styleRuns: [...styleRuns] })
      const rounded = layout.getLineMetrics().map((line) => Math.round(line.baseline))
      expect(inkBottoms(layout).map((bottom) => bottom + 1)).toEqual(rounded)
      layout.delete()
    }
  })

  test('draws a line of each size on the whole pixel Figma draws it on', () => {
    for (const [fontSize, drawn] of [
      [12, 12],
      [14, 14],
      [16, 15],
      [18, 18],
      [20, 19],
      [28, 27]
    ] as const) {
      const layout = layOut({ text: 'H', fontSize })
      expect(inkBottoms(layout).map((bottom) => bottom + 1)).toEqual([drawn])
      layout.delete()
    }
  })

  for (const { fontSize, lineHeight, paragraphSpacing = 0, saved, drawn } of cases) {
    const name = `${fontSize} px at ${lineHeight ?? 'auto'}${paragraphSpacing ? `, ${paragraphSpacing} apart` : ''}`
    test(`keeps exact baselines and draws them on whole pixels: ${name}`, () => {
      const layout = layOut({
        text: Array.from({ length: saved.length }, () => 'H').join('\n'),
        fontSize,
        lineHeight: lineHeight === null ? null : pixelLength(lineHeight),
        paragraphSpacing
      })
      expectBaselines(layout, saved)
      // "H" has no descender, so its ink ends on the row above its baseline.
      expect(inkBottoms(layout).map((bottom) => bottom + 1)).toEqual(drawn)
      layout.delete()
    })
  }
})
