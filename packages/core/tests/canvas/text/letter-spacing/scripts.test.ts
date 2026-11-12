import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  ARABIC_FAMILY,
  canvasKit,
  EPSILON,
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import { expectDefined } from '@open-pencil/test-support/assert'

import type { TextLayout } from '#core/canvas/text/layout'
import { lineSpacing } from '#core/canvas/text/layout/letter-spacing'
import { styledRanges } from '#core/canvas/text/paragraph/runs'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

const UNBOUNDED_WIDTH = { width: 400, textAutoResize: 'WIDTH_AND_HEIGHT' as const }

function lastLine(layout: TextLayout) {
  return expectDefined(layout.getLineMetrics().at(-1), 'line')
}

function lastLineGlyphs(layout: TextLayout): number {
  return layout.getLineGlyphsWidth(layout.getLineMetrics().length - 1)
}

function glyphsAndWidth(props: Props): { glyphs: number; width: number } {
  const layout = laidOut(props)
  const result = { glyphs: lastLineGlyphs(layout), width: lastLine(layout).width }
  layout.delete()
  return result
}

describe('the spacing after a line’s last character is the one Skia shapes', () => {
  test.each(['\n', '\v', '\f', '\r', '\u0085', '\u2028', '\u2029'])(
    'punctuation after %j that follows arabic keeps its spacing',
    (separator) => {
      const { glyphs, width } = glyphsAndWidth({
        text: `Aسلام${separator}!!!`,
        fontFamily: ARABIC_FAMILY,
        letterSpacing: pixels(4),
        ...UNBOUNDED_WIDTH
      })
      expect(glyphs).toBeCloseTo(width - 4, 2)
    }
  )

  test.each(['\u{10D00}\u{10D01}\u{10D02}', 'ab\u{10D00}\u{10D01}\u{10D02}', 'ab\u0628\u0628'])(
    '%j, ending in a script Skia never spaces, has no spacing to take off',
    (value) => {
      const { glyphs, width } = glyphsAndWidth({
        text: value,
        letterSpacing: pixels(5),
        ...UNBOUNDED_WIDTH
      })
      expect(glyphs).toBeCloseTo(width, 2)
    }
  )

  test('a spacing run over half an emoji is left out, as the paragraph leaves it', () => {
    const props: Props = { text: 'ab😀', letterSpacing: pixels(0), ...UNBOUNDED_WIDTH }
    const plain = glyphsAndWidth(props)
    const split = glyphsAndWidth({
      ...props,
      styleRuns: [{ start: 3, length: 1, style: { letterSpacing: pixels(10) } }]
    })
    expect(split.glyphs).toBeCloseTo(plain.glyphs, 2)
  })

  test('overlapping runs count the characters they cover once', () => {
    const run = { start: 0, length: 4, style: { letterSpacing: pixels(0) } }
    const props: Props = { text: 'abcdefgh', letterSpacing: pixels(6), ...UNBOUNDED_WIDTH }
    const once = glyphsAndWidth({ ...props, styleRuns: [run] })
    const twice = glyphsAndWidth({ ...props, styleRuns: [run, run] })
    expect(twice.glyphs).toBeCloseTo(once.glyphs, 2)
    expect(once.glyphs).toBeCloseTo(once.width - 6, 2)
  })
})

describe('right-to-left text', () => {
  const box = 120
  const spacing = 3
  test.each(['LEFT', 'CENTER', 'RIGHT'] as const)(
    'a truncated spaced line, %s, stays in the box',
    (align) => {
      const layout = laidOut({
        text: 'שלום עולם זה טקסט ארוך מאוד שנחתך',
        width: box,
        textAutoResize: 'HEIGHT',
        textAlignHorizontal: align,
        letterSpacing: pixels(spacing),
        textTruncation: 'ENDING',
        maxLines: 1
      })
      const line = expectDefined(layout.getShapedLines()[0], 'line')
      const xs = line.runs.flatMap((run) =>
        Array.from(run.positions).filter((_, index) => index % 2 === 0)
      )
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-EPSILON)
      expect(Math.max(...xs) - spacing).toBeLessThanOrEqual(box + EPSILON)
      layout.delete()
    }
  )

  test.each([
    ['CENTER', percent(4)],
    ['RIGHT', pixels(8)]
  ] as const)(
    'a click on a glyph of a joined line’s last hebrew word, %s, lands on it',
    (align, letterSpacing) => {
      const ck = canvasKit()
      const value = 'Paragraph words to wrap here at three hundred pixels שלום עולם\nNext line here'
      const layout = laidOut({
        text: value,
        width: 300,
        textAutoResize: 'HEIGHT',
        textAlignHorizontal: align,
        letterSpacing
      })
      const lineEnd = value.indexOf('\n')
      const line = expectDefined(
        layout.getLineMetrics()[layout.getLineNumberAt(lineEnd - 1)],
        'line'
      )
      for (let index = value.indexOf('שלום'); index < lineEnd; index++) {
        const [box] = layout.getRectsForRange(
          index,
          index + 1,
          ck.RectHeightStyle.Tight,
          ck.RectWidthStyle.Tight
        )
        const middle = (box.rect[0] + box.rect[2]) / 2
        const hit = layout.getGlyphPositionAtCoordinate(middle, line.baseline - 2).pos
        expect([index, index + 1]).toContain(hit)
      }
      layout.delete()
    }
  )
})

describe('spacing after each character', () => {
  const ARABIC_PREFIX = 'سلام '
  const BASE_SPACING = 7
  const LATIN_LENGTH = 300

  function runSpacing(index: number): number {
    return index % 4
  }

  function spacingOfEveryCharacter(sourceIndex: (index: number) => number): number[] {
    const text = ARABIC_PREFIX + 'a'.repeat(LATIN_LENGTH)
    const runs = Array.from({ length: LATIN_LENGTH / 2 }, (_, index) => ({
      start: ARABIC_PREFIX.length + index * 2,
      length: 1,
      style: { letterSpacing: pixels(runSpacing(index)) }
    }))
    const spacing = lineSpacing({
      text,
      letterSpacing: pixels(BASE_SPACING),
      fontSize: 16,
      styleRuns: styledRanges(text, runs),
      sourceLength: text.length,
      sourceIndex
    })
    return Array.from(text, (_, index) => spacing.after(index))
  }

  function expectedSpacing(shownIndex: number, sourceIndex: number): number {
    if (shownIndex < ARABIC_PREFIX.length) {
      return 0
    }
    const latin = sourceIndex - ARABIC_PREFIX.length
    if (latin < 0 || latin % 2 === 1) {
      return BASE_SPACING
    }
    return runSpacing(latin / 2)
  }

  test('each character takes its own run’s spacing among many one-character runs', () => {
    const spacings = spacingOfEveryCharacter((index) => index)
    expect(spacings).toEqual(spacings.map((_, index) => expectedSpacing(index, index)))
  })

  test('a shown character takes the spacing of the source character it came from', () => {
    const shifted = (index: number) => Math.max(0, index - 1)
    const spacings = spacingOfEveryCharacter(shifted)
    expect(spacings).toEqual(spacings.map((_, index) => expectedSpacing(index, shifted(index))))
  })
})
