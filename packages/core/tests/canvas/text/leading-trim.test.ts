import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

import { textVerticalOffset } from '#core/canvas/text'
import type { TextLayout } from '#core/canvas/text/layout'
import { buildParagraph } from '#core/canvas/text/layout/build'
import { getCanvasKit } from '#core/canvaskit'
import { estimateTextSize } from '#core/layout/text-measurement'
import { TYPICAL_CAP_HEIGHT_EMS } from '#core/text/font/glyphs'
import { fontInstance, harfBuzzFont } from '#core/text/font/harfbuzz'
import { fontManager } from '#core/text/font/manager'
import { fontTableView } from '#core/text/font/variation'

const INTER_UNITS_PER_EM = 2048
const INTER_CAP_HEIGHT_UNITS = 1490
const INTER_CAP_HEIGHT_EMS = INTER_CAP_HEIGHT_UNITS / INTER_UNITS_PER_EM
const BADGE_FONT_SIZES = [12, 14, 16, 18, 24, 28, 32]
const SURFACE_SIZE = 200
const OS2_VERSION_WITHOUT_CAP_HEIGHT = 1
const OS2_CAP_HEIGHT = 88
const HHEA_ASCENDER = 4
const HHEA_DESCENDER = 6
const MVAR_RECORDS = 12
const MVAR_RECORD_SIZE = 6
const MVAR_RECORD_COUNT = 8
const LARGEST_OPTICAL_SIZE = 32

let ck: CanvasKit
let provider: TypefaceFontProvider
let interAscenderEms = 0
let interDescenderEms = 0
let displayCapHeightEms = 0

function textNode(props: Partial<SceneNode>): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 24,
    lineHeight: percentLength(110),
    leadingTrim: 'CAP_HEIGHT',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 100,
    height: 100,
    ...props
  })
}

function layOutNode(node: SceneNode): TextLayout {
  return buildParagraph({ ck, fontProvider: provider, fontsLoaded: true }, node, undefined, {
    halfLeading: true
  })
}

function layOut(props: Partial<SceneNode>): TextLayout {
  return layOutNode(textNode(props))
}

function baselines(layout: TextLayout): number[] {
  return layout.getLineMetrics().map((line) => line.baseline)
}

function inkRows(layout: TextLayout, top = 0): { top: number; bottom: number } {
  const surface = expectDefined(ck.MakeSurface(SURFACE_SIZE, SURFACE_SIZE), 'surface')
  try {
    const canvas = surface.getCanvas()
    canvas.clear(ck.WHITE)
    layout.draw(canvas, 0, top)
    const pixels = expectDefined(
      canvas.readPixels(0, 0, {
        width: SURFACE_SIZE,
        height: SURFACE_SIZE,
        colorType: ck.ColorType.RGBA_8888,
        alphaType: ck.AlphaType.Unpremul,
        colorSpace: ck.ColorSpace.SRGB
      }),
      'pixels'
    )
    const inked: number[] = []
    for (let y = 0; y < SURFACE_SIZE; y++) {
      for (let x = 0; x < SURFACE_SIZE; x++) {
        if (pixels[(y * SURFACE_SIZE + x) * 4] < 128) {
          inked.push(y)
          break
        }
      }
    }
    return { top: inked.at(0) ?? -1, bottom: inked.at(-1) ?? -1 }
  } finally {
    surface.delete()
  }
}

function withoutCapHeight(font: ArrayBuffer): ArrayBuffer {
  const copy = font.slice(0)
  expectDefined(fontTableView(copy, 'OS/2'), 'OS/2 table').setUint16(
    0,
    OS2_VERSION_WITHOUT_CAP_HEIGHT
  )
  return copy
}

function withZeroCapHeight(font: ArrayBuffer): ArrayBuffer {
  const copy = font.slice(0)
  expectDefined(fontTableView(copy, 'OS/2'), 'OS/2 table').setInt16(OS2_CAP_HEIGHT, 0)
  return copy
}

/** Inter's MVAR varies its x-height only: the copy varies its cap height by the same deltas. */
function withCapHeightVariation(font: ArrayBuffer): ArrayBuffer {
  const copy = font.slice(0)
  const mvar = expectDefined(fontTableView(copy, 'MVAR'), 'MVAR table')
  const size = mvar.getUint16(MVAR_RECORD_SIZE)
  const count = mvar.getUint16(MVAR_RECORD_COUNT)
  const records = new Uint8Array(mvar.buffer, mvar.byteOffset + MVAR_RECORDS, size * count)
  const xHeight = records.slice(size * (count - 1))
  expect(new TextDecoder().decode(xHeight.subarray(0, 4))).toBe('xhgt')
  records.copyWithin(size, 0, size * (count - 1))
  records.set(new TextEncoder().encode('cpht'), 0)
  records.set(xHeight.subarray(4), 4)
  return copy
}

function xHeightUnits(font: ArrayBuffer, opticalSize: number | null): number {
  const parsed = expectDefined(harfBuzzFont(font), 'HarfBuzz font')
  const variations = opticalSize === null ? [] : [{ axis: 'opsz', value: opticalSize }]
  return fontInstance(parsed, variations).font.getMetricPositionWithFallback(
    parsed.hb.MetricsTag.X_HEIGHT
  )
}

describe('cap-height leading trim', () => {
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
    const noCapHeight = withoutCapHeight(inter)
    provider.registerFont(noCapHeight, 'No Cap Height')
    await fontManager.markLoaded('No Cap Height', 'Regular', noCapHeight)
    const zeroCapHeight = withZeroCapHeight(inter)
    provider.registerFont(zeroCapHeight, 'Zero Cap Height')
    await fontManager.markLoaded('Zero Cap Height', 'Regular', zeroCapHeight)
    const capAxis = withCapHeightVariation(inter)
    provider.registerFont(capAxis, 'Cap Axis')
    await fontManager.markLoaded('Cap Axis', 'Regular', capAxis)
    const displayDelta = xHeightUnits(inter, LARGEST_OPTICAL_SIZE) - xHeightUnits(inter, null)
    displayCapHeightEms = (INTER_CAP_HEIGHT_UNITS + displayDelta) / INTER_UNITS_PER_EM
    const hhea = expectDefined(fontTableView(inter, 'hhea'), 'hhea table')
    interAscenderEms = hhea.getInt16(HHEA_ASCENDER) / INTER_UNITS_PER_EM
    interDescenderEms = -hhea.getInt16(HHEA_DESCENDER) / INTER_UNITS_PER_EM
  })

  afterAll(() => {
    fontManager.detachProvider(provider)
    provider.delete()
  })

  test('sets a digit of each size from its cap height down to its baseline', () => {
    for (const fontSize of BADGE_FONT_SIZES) {
      const capHeight = INTER_CAP_HEIGHT_EMS * fontSize
      const layout = layOut({ text: '75', fontSize })
      expect(baselines(layout)[0]).toBeCloseTo(capHeight, 2)
      expect(layout.getHeight()).toBeCloseTo(capHeight, 2)
      expect(inkRows(layout).top).toBeLessThanOrEqual(1)
      layout.delete()
    }
  })

  test('trims a text of several lines to its first cap height and last baseline', () => {
    const layout = layOut({ text: '75\n50', fontSize: 20 })
    const [first, second] = baselines(layout)
    expect(baselines(layout)).toHaveLength(2)
    expect(first).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(second - first).toBeCloseTo(22, 2)
    expect(layout.getHeight()).toBeCloseTo(second, 2)
    layout.delete()
  })

  test('steps lines by a line height in pixels', () => {
    const layout = layOut({ text: '75\n50', fontSize: 20, lineHeight: pixelLength(30) })
    const [first, second] = baselines(layout)
    expect(first).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(second - first).toBeCloseTo(30, 2)
    expect(layout.getHeight()).toBeCloseTo(second, 2)
    layout.delete()
  })

  test('steps lines by the font line height when the line height is auto', () => {
    const layout = layOut({ text: '75\n50', fontSize: 20, lineHeight: null })
    const [first, second] = baselines(layout)
    expect(first).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(second - first).toBeCloseTo((interAscenderEms + interDescenderEms) * 20, 0)
    expect(layout.getHeight()).toBeCloseTo(second, 2)
    layout.delete()
  })

  test('keeps paragraph spacing between the trimmed lines', () => {
    const layout = layOut({ text: '75\n50', fontSize: 20, paragraphSpacing: 10 })
    const [first, second] = baselines(layout)
    expect(first).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(second - first).toBeCloseTo(32, 2)
    expect(layout.getHeight()).toBeCloseTo(second, 2)
    layout.delete()
  })

  test('keeps a truncated last line whose baseline fits the box', () => {
    const truncated = {
      text: 'Ab\nCd',
      fontSize: 20,
      textAutoResize: 'NONE' as const,
      textTruncation: 'ENDING' as const
    }
    const capHeight = INTER_CAP_HEIGHT_EMS * 20
    for (const height of [capHeight + 22, 37]) {
      const fits = layOut({ ...truncated, height })
      expect(baselines(fits)).toHaveLength(2)
      expect(baselines(fits)[1]).toBeCloseTo(capHeight + 22, 2)
      fits.delete()
    }
    const overflows = layOut({ ...truncated, height: 36 })
    expect(baselines(overflows)).toHaveLength(1)
    overflows.delete()
  })

  test('centres and bottom-aligns the trimmed box from cap height to baseline', () => {
    const capHeight = INTER_CAP_HEIGHT_EMS * 20
    for (const [textAlignVertical, top] of [
      ['CENTER', (60 - capHeight) / 2],
      ['BOTTOM', 60 - capHeight]
    ] as const) {
      const node = textNode({
        text: 'HE',
        fontSize: 20,
        textAutoResize: 'NONE',
        height: 60,
        textAlignVertical
      })
      const layout = layOutNode(node)
      const offset = textVerticalOffset(node, layout.getHeight())
      expect(offset).toBeCloseTo(top, 2)
      const ink = inkRows(layout, offset)
      expect(Math.abs(ink.top - top)).toBeLessThanOrEqual(1)
      expect(Math.abs(ink.bottom + 1 - (top + capHeight))).toBeLessThanOrEqual(1)
      layout.delete()
    }
  })

  test('puts the tallest cap height of the first line at the top', () => {
    const layout = layOut({
      text: 'aBIG',
      fontSize: 40,
      styleRuns: [{ start: 0, length: 1, style: { fontSize: 12 } }]
    })
    expect(baselines(layout)[0]).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 40, 2)
    expect(inkRows(layout).top).toBeLessThanOrEqual(1)
    layout.delete()
  })

  test('takes the first line cap height from the characters a case shows', () => {
    const layout = layOut({
      text: 'ßßa\nB',
      fontSize: 20,
      textCase: 'UPPER',
      styleRuns: [{ start: 4, length: 1, style: { fontSize: 60 } }]
    })
    expect(baselines(layout)[0]).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    layout.delete()
  })

  test('takes the cap height a variable font varies by optical size at the drawn axes', () => {
    const fontSize = LARGEST_OPTICAL_SIZE
    expect(Math.abs(displayCapHeightEms - INTER_CAP_HEIGHT_EMS) * fontSize).toBeGreaterThan(0.5)
    const layout = layOut({
      text: '75',
      fontSize,
      fontFamily: 'Cap Axis',
      fontVariations: [{ axis: 'opsz', value: LARGEST_OPTICAL_SIZE }]
    })
    expect(baselines(layout)[0]).toBeCloseTo(displayCapHeightEms * fontSize, 2)
    expect(layout.getHeight()).toBeCloseTo(displayCapHeightEms * fontSize, 2)
    layout.delete()
  })

  test('measures the cap height from the glyphs of a font that declares none', () => {
    const layout = layOut({ text: 'HE', fontSize: 20, fontFamily: 'No Cap Height' })
    expect(baselines(layout)[0]).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(inkRows(layout).top).toBeLessThanOrEqual(1)
    layout.delete()
  })

  test('trims to a typical cap height a font that declares a zero one', () => {
    const node = textNode({ text: 'HE', fontSize: 20, fontFamily: 'Zero Cap Height' })
    const layout = layOutNode(node)
    expect(baselines(layout)[0]).toBeCloseTo(TYPICAL_CAP_HEIGHT_EMS * 20, 2)
    expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
  })

  test('keeps the line box of untrimmed text', () => {
    const layout = layOut({ text: '75', fontSize: 20, leadingTrim: 'NONE' })
    const contentHeight = (interAscenderEms + interDescenderEms) * 20
    expect(baselines(layout)[0]).toBeCloseTo((22 - contentHeight) / 2 + interAscenderEms * 20, 2)
    expect(layout.getHeight()).toBeCloseTo(22, 2)
    layout.delete()
  })

  test('estimates a trimmed size without CanvasKit as live layout lays it out', () => {
    const node = textNode({ text: '75', fontSize: 20 })
    const layout = layOutNode(node)
    expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
    const unknown = textNode({ text: '75', fontSize: 20, fontFamily: 'Not Loaded Anywhere' })
    const fallback = layOutNode(unknown)
    expect(estimateTextSize(unknown).height).toBeCloseTo(fallback.getHeight(), 2)
    fallback.delete()
  })

  test('estimates a text of several lines as live layout lays it out', () => {
    for (const leadingTrim of ['CAP_HEIGHT', 'NONE'] as const) {
      const node = textNode({ text: '75\n50', fontSize: 20, leadingTrim })
      const layout = layOutNode(node)
      expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
      layout.delete()
    }
  })

  test('estimates the space between paragraphs as live layout lays it out', () => {
    for (const leadingTrim of ['CAP_HEIGHT', 'NONE'] as const) {
      const node = textNode({ text: '75\n50\n25', fontSize: 20, paragraphSpacing: 10, leadingTrim })
      const layout = layOutNode(node)
      expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
      layout.delete()
    }
  })

  test('estimates only the lines a truncated text shows', () => {
    for (const leadingTrim of ['CAP_HEIGHT', 'NONE'] as const) {
      const node = textNode({
        text: '75\n50\nWWWWWWWW',
        fontSize: 20,
        paragraphSpacing: 10,
        textTruncation: 'ENDING',
        maxLines: 2,
        leadingTrim
      })
      const layout = layOutNode(node)
      const estimate = estimateTextSize(node)
      expect(estimate.height).toBeCloseTo(layout.getHeight(), 2)
      expect(estimate.width).toBe(Math.ceil(layout.getLongestLine()))
      layout.delete()
    }
  })

  test('estimates the tallest cap height of the first line', () => {
    const node = textNode({
      text: 'aBIG',
      fontSize: 12,
      styleRuns: [{ start: 1, length: 3, style: { fontSize: 40 } }]
    })
    const layout = layOutNode(node)
    expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
  })

  test('estimates a variable font trimmed at its drawn optical size', () => {
    const node = textNode({
      text: '75',
      fontSize: LARGEST_OPTICAL_SIZE,
      fontFamily: 'Cap Axis',
      fontVariations: [{ axis: 'opsz', value: LARGEST_OPTICAL_SIZE }]
    })
    const layout = layOutNode(node)
    expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
  })

  test('estimates a variable font at an optical size set apart from its font size', () => {
    const node = textNode({
      text: '75',
      fontSize: 20,
      fontFamily: 'Cap Axis',
      opticalSizeFromFontSize: false,
      fontVariations: [{ axis: 'opsz', value: LARGEST_OPTICAL_SIZE }]
    })
    const layout = layOutNode(node)
    expect(layout.getHeight()).not.toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(estimateTextSize(node).height).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
  })

  test('trims empty text as its first character, and estimates it the same', () => {
    const empty = textNode({ text: '', fontSize: 20 })
    const layout = layOutNode(empty)
    const typed = layOut({ text: '7', fontSize: 20 })
    expect(layout.getHeight()).toBeCloseTo(INTER_CAP_HEIGHT_EMS * 20, 2)
    expect(estimateTextSize(empty).height).toBeCloseTo(layout.getHeight(), 2)
    expect(typed.getHeight()).toBeCloseTo(layout.getHeight(), 2)
    layout.delete()
    typed.delete()
  })
})
