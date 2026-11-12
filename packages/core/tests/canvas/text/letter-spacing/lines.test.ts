import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  ALIGNS,
  EPSILON,
  expectBreaksBeforeWordsThatDoNotFit,
  expectEllipsisLine,
  expectFigmaLines,
  figmaLines,
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  renderer,
  SENTENCE,
  spans,
  text,
  truncatedSpan,
  type Case,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import type { StyleRun, TextLength } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { measureTextAsDrawn } from '#core/canvas/text'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

describe('mixed runs over several lines', () => {
  const sentence = SENTENCE
  const spacedFrom = (start: number, letterSpacing: TextLength): StyleRun[] => [
    { start, length: sentence.length - start, style: { letterSpacing } }
  ]
  const tail: Props = { text: sentence, styleRuns: spacedFrom(13, percent(20)) }

  // One Skia layout cannot break at one width and stretch to another: a justified line ending in
  // less spacing than the text's widest narrows the layout, and other lines may wrap sooner.
  test.each(['LEFT', 'CENTER', 'RIGHT'] as const)(
    '%s: a line breaks only before a word its glyphs have no room for',
    (textAlignHorizontal) => {
      for (const width of [116, 150, 190]) {
        const box: Props = { ...tail, width, textAutoResize: 'HEIGHT', textAlignHorizontal }
        const layout = laidOut(box)
        expectBreaksBeforeWordsThatDoNotFit(box, layout, width)
        layout.delete()
      }
    }
  )

  test.each(ALIGNS.map((align) => [align] as const))(
    '%s: each line starts where Figma aligns it',
    (textAlignHorizontal) => {
      for (const width of [116, 150, 190]) {
        const box: Props = { ...tail, width, textAutoResize: 'HEIGHT', textAlignHorizontal }
        const layout = laidOut(box)
        const lines = figmaLines(box, layout)
        layout.delete()
        expectFigmaLines(textAlignHorizontal, lines, width)
      }
    }
  )

  test.each(ALIGNS.map((align) => [align] as const))(
    '%s: a text cut to two lines aligns its first line and keeps its ellipsis inside the box',
    (textAlignHorizontal) => {
      for (const width of [101, 133, 157]) {
        const box: Props = {
          text: sentence,
          letterSpacing: pixels(3),
          width,
          textAutoResize: 'HEIGHT',
          textAlignHorizontal,
          textTruncation: 'ENDING',
          maxLines: 2
        }
        const layout = laidOut(box)
        const [first] = figmaLines(box, layout)
        const last = truncatedSpan(expectDefined(layout.getShapedLines()[1], 'line'))
        expect(layout.didExceedMaxLines()).toBe(true)
        layout.delete()
        expectFigmaLines(textAlignHorizontal, [first], width)
        expectEllipsisLine(textAlignHorizontal, last, width)
      }
    }
  )

  const titled: Case[] = [
    {
      label: 'an overline after the title',
      props: {
        text: 'Settings and more\nNEW',
        styleRuns: [{ start: 18, length: 3, style: { letterSpacing: percent(40) } }]
      }
    },
    {
      label: 'spaced capitals after the title',
      props: {
        text: 'Settings\nUPDATED TODAY',
        styleRuns: [{ start: 9, length: 13, style: { letterSpacing: percent(10) } }]
      }
    }
  ]
  const titledRows = titled.flatMap((testCase) =>
    ALIGNS.map((align) => [testCase.label, align, testCase] as const)
  )

  test.each(titledRows)(
    '%s, %s: auto width keeps the lines and their glyphs inside the box',
    (_, textAlignHorizontal, { props }) => {
      const aligned = { ...props, textAlignHorizontal }
      const width = expectDefined(measureTextAsDrawn(renderer(), text(aligned)), 'size').width
      const box = { ...aligned, width, textAutoResize: 'HEIGHT' as const }
      const layout = laidOut(box)
      const drawn = spans(box, layout)
      layout.delete()
      expect(drawn).toHaveLength(2)
      for (const line of drawn) {
        expect(line.start).toBeGreaterThanOrEqual(-EPSILON)
        expect(line.end).toBeLessThanOrEqual(width + EPSILON)
      }
      if (textAlignHorizontal === 'LEFT') {
        expect(width).toBe(Math.ceil(Math.max(...drawn.map((line) => line.end)) - EPSILON))
      }
    }
  )
})

describe("lines break and align as Figma's saved layouts of the mixed-spacing fixture do", () => {
  const sentence = SENTENCE
  const words = 'Settings and more options for everyone'
  const firstWord = 'Settings'.length
  const range = (from: number, to: number, step: number) =>
    Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step)
  const groups: Array<Case & { widths: number[] }> = [
    {
      label: 'first word 15%, rest 0',
      props: {
        text: sentence,
        styleRuns: [{ start: 0, length: firstWord, style: { letterSpacing: percent(15) } }]
      },
      widths: range(100, 130, 1)
    },
    {
      label: 'base 10%, rest -8%',
      props: {
        text: words,
        letterSpacing: percent(10),
        styleRuns: [
          {
            start: firstWord,
            length: words.length - firstWord,
            style: { letterSpacing: percent(-8) }
          }
        ]
      },
      widths: range(94, 112, 1)
    },
    {
      label: '10% at 18px, one word at 36px',
      props: {
        text: sentence,
        fontSize: 18,
        letterSpacing: percent(10),
        styleRuns: [
          { start: sentence.indexOf('options'), length: 'options'.length, style: { fontSize: 36 } }
        ]
      },
      widths: range(120, 300, 10)
    },
    {
      label: 'uniform 10%',
      props: { text: sentence, letterSpacing: percent(10) },
      widths: range(100, 130, 2)
    }
  ]
  const groupRows = groups.flatMap((group) =>
    ALIGNS.map((align) => [group.label, align, group] as const)
  )

  test.each(groupRows)(
    '%s, %s: lines break by their glyphs and align with the spacing a wrapped line ends in',
    (_, textAlignHorizontal, { props, widths }) => {
      for (const width of widths) {
        const box: Props = { ...props, width, textAutoResize: 'HEIGHT', textAlignHorizontal }
        const layout = laidOut(box)
        const lines = figmaLines(box, layout)
        expectBreaksBeforeWordsThatDoNotFit(box, layout, width)
        layout.delete()
        expectFigmaLines(textAlignHorizontal, lines, width)
      }
    }
  )

  test.each(
    (['CENTER', 'RIGHT'] as const).flatMap((align) =>
      [2, 3].map((maxLines) => [align, maxLines] as const)
    )
  )(
    '3px, %s, cut to %d lines: lines above the ellipsis align as Figma aligns them',
    (textAlignHorizontal, maxLines) => {
      for (const width of range(101, 165, 4)) {
        const box: Props = {
          text: sentence,
          letterSpacing: pixels(3),
          width,
          textAutoResize: 'HEIGHT',
          textAlignHorizontal,
          textTruncation: 'ENDING',
          maxLines
        }
        const layout = laidOut(box)
        const lineCount = layout.getLineMetrics().length
        const lines = figmaLines(box, layout)
        const ellipsis = truncatedSpan(expectDefined(layout.getShapedLines().at(-1), 'line'))
        const truncated = layout.didExceedMaxLines()
        layout.delete()
        expect(truncated).toBe(true)
        expect(lineCount).toBe(maxLines)
        expectFigmaLines(textAlignHorizontal, lines.slice(0, -1), width)
        expectEllipsisLine(textAlignHorizontal, ellipsis, width)
      }
    }
  )
})
