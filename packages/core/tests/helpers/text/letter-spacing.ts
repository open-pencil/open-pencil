import { expect } from 'bun:test'

import type { CanvasKit, ShapedLine, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph, type SceneNode, type TextLength } from '@open-pencil/scene-graph'
import { textLengthPixels } from '@open-pencil/scene-graph/text'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { TextLayout } from '#core/canvas/text/layout'
import { buildParagraph } from '#core/canvas/text/layout/build'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/font/manager'

export const EPSILON = 0.01
export const UNBOUNDED = 1e5
export const ALIGNS = ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const
export const SENTENCE = 'Settings and more options for everyone in the team today'
export const ARABIC_FAMILY = 'Noto Naskh Arabic'

export const percent = (value: number): TextLength => ({ value, unit: 'PERCENT' })
export const pixels = (value: number): TextLength => ({ value, unit: 'PIXELS' })

export type Props = Partial<SceneNode> & { text: string }

export interface Case {
  label: string
  props: Props
}

let ck: CanvasKit
let provider: TypefaceFontProvider
const graph = new SceneGraph()

export function canvasKit(): CanvasKit {
  return ck
}

export function renderer(): TextRenderer {
  return { ck, fontProvider: provider, fontsLoaded: true }
}

export function text(props: Props): SceneNode {
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: null,
    width: 1,
    height: 200,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...props
  })
}

export function laidOut(props: Props): TextLayout {
  return buildParagraph(renderer(), text(props))
}

export function lengthLabel(length: TextLength): string {
  return `${length.value}${length.unit === 'PERCENT' ? '%' : 'px'}`
}

/** The spacing after the character at `index`, as the text's style sets it. */
export function spacingAt(props: Props, index: number): number {
  const run = props.styleRuns?.find(
    ({ start, length }) => index >= start && index < start + length
  )?.style
  const fontSize = run?.fontSize ?? props.fontSize ?? 16
  return textLengthPixels(run?.letterSpacing ?? props.letterSpacing ?? pixels(0), fontSize)
}

/** Where a shaped line's glyphs draw, without the spacing after its last one. */
export function glyphSpan(props: Props, line: ShapedLine): { start: number; end: number } {
  let start = Infinity
  let end = -Infinity
  let lastOffset = 0
  for (const run of line.runs) {
    const glyphs = run.glyphs.length
    for (let index = 0; index < glyphs; index++) {
      start = Math.min(start, run.positions[2 * index])
    }
    if (run.positions[2 * glyphs] > end) {
      end = run.positions[2 * glyphs]
      lastOffset = run.offsets[glyphs - 1]
    }
  }
  return { start, end: end - spacingAt(props, lastOffset) }
}

/** Where a truncated line draws, its ellipsis set without letter spacing included. */
export function truncatedSpan(line: ShapedLine): { start: number; end: number } {
  const xs = line.runs.flatMap((run) => [...run.positions].filter((_, index) => index % 2 === 0))
  return { start: Math.min(...xs), end: Math.max(...xs) }
}

export function spans(props: Props, layout: TextLayout) {
  return layout.getShapedLines().map((line) => glyphSpan(props, line))
}

export type Align = (typeof ALIGNS)[number]

interface FigmaLine {
  start: number
  end: number
  wrapsAtSpace: boolean
  hungSpacing: number
}

/**
 * Each line's glyph span, with the spacing Figma keeps after the glyphs of a line that wraps at
 * a space; the paragraph's last line and a line split inside a word keep none.
 */
export function figmaLines(props: Props, layout: TextLayout): FigmaLine[] {
  const metrics = layout.getLineMetrics()
  return spans(props, layout).map((span, index) => {
    const line = metrics[index]
    const wrapsAtSpace =
      index < metrics.length - 1 &&
      !line.isHardBreak &&
      line.endExcludingWhitespaces < line.endIndex
    const last = line.endExcludingWhitespaces - 1
    return { ...span, wrapsAtSpace, hungSpacing: wrapsAtSpace ? spacingAt(props, last) : 0 }
  })
}

/** Where Figma starts a line's glyphs: its glyphs and hung spacing at the box's start, end or centre. */
export function figmaLineStart(align: Align, line: FigmaLine, width: number): number {
  const free = width - (line.end - line.start + line.hungSpacing)
  const starts: Record<Align, number> = { LEFT: 0, JUSTIFIED: 0, CENTER: free / 2, RIGHT: free }
  return starts[align]
}

export function expectFigmaLines(align: Align, lines: readonly FigmaLine[], width: number): void {
  for (const line of lines) {
    expect(line.start).toBeCloseTo(figmaLineStart(align, line, width), 2)
    expect(line.end - line.start).toBeLessThanOrEqual(width + EPSILON)
  }
}

export function expectEllipsisLine(
  align: Align,
  line: { start: number; end: number },
  width: number
) {
  const unwrapped = { ...line, wrapsAtSpace: false, hungSpacing: 0 }
  expect(line.start).toBeCloseTo(figmaLineStart(align, unwrapped, width), 2)
  expect(line.start).toBeGreaterThanOrEqual(-EPSILON)
  expect(line.end).toBeLessThanOrEqual(width + EPSILON)
}

/** The props of the characters from `start` to `end`, with their style runs. */
export function slice(props: Props, start: number, end: number): Props {
  return {
    ...props,
    text: props.text.slice(start, end),
    styleRuns: (props.styleRuns ?? []).flatMap((run) => {
      const from = Math.max(start, run.start)
      const to = Math.min(end, run.start + run.length)
      return to > from ? [{ start: from - start, length: to - from, style: run.style }] : []
    })
  }
}

/** Each line wrapped at a space would not fit with the next word on it. */
export function expectBreaksBeforeWordsThatDoNotFit(
  props: Props,
  layout: TextLayout,
  width: number
) {
  const lines = layout.getLineMetrics()
  for (const [index, line] of lines.slice(0, -1).entries()) {
    if (line.endExcludingWhitespaces === line.endIndex) {
      continue
    }
    const nextWordEnd = props.text.indexOf(' ', lines[index + 1].startIndex)
    const end = nextWordEnd === -1 ? props.text.length : nextWordEnd
    expect(glyphsWidth(slice(props, line.startIndex, end))).toBeGreaterThan(width - EPSILON)
  }
}

/** The width of the text's glyphs on one line, from where the paragraph places them. */
export function glyphsWidth(props: Props): number {
  const unbounded = { ...props, width: UNBOUNDED, textAutoResize: 'HEIGHT' as const }
  const layout = laidOut({ ...unbounded, textAlignHorizontal: 'LEFT' })
  const span = glyphSpan(unbounded, expectDefined(layout.getShapedLines()[0], 'line'))
  layout.delete()
  return span.end - span.start
}

export function lineCount(props: Props): number {
  const layout = laidOut(props)
  const count = layout.getLineMetrics().length
  layout.delete()
  return count
}

export async function loadSpacedTextFonts(): Promise<void> {
  ck = await getCanvasKit()
  provider = ck.TypefaceFontProvider.Make()
  fontManager.attachProvider(ck, provider)
  const bundled = async (path: string) =>
    expectDefined(await fontManager.fetchBundledFont(path), path)
  const variable = await bundled('/InterVariable.ttf')
  for (const style of ['Regular', 'Medium', 'Bold']) {
    await fontManager.markLoaded('Inter', style, variable)
  }
  await fontManager.markLoaded('Inter', 'Italic', await bundled('/InterVariable-Italic.ttf'))
  await fontManager.markLoaded(
    ARABIC_FAMILY,
    'Regular',
    await bundled('/NotoNaskhArabic-Regular.ttf')
  )
}

export function releaseSpacedTextFonts(): void {
  fontManager.detachProvider(provider)
  provider.delete()
}
