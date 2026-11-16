import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  ALIGNS,
  ARABIC_FAMILY,
  EPSILON,
  expectEllipsisLine,
  expectFigmaLines,
  figmaLines,
  glyphsWidth,
  laidOut,
  lengthLabel,
  lineCount,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  renderer,
  spans,
  text,
  truncatedSpan,
  type Case,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import type { CharacterStyleOverride, StyleRun, TextLength } from '@open-pencil/scene-graph'
import { maxOf, minOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

import { measureTextAsDrawn } from '#core/canvas/text'
import type { TextLayout } from '#core/canvas/text/layout'

const MARGIN = 20
const TEXT = 'Settings 24'
const EM_WIDE = '—'
const WORDS = 'Settings and more options for everyone'
const ARABIC = 'مرحبا بكم في عالم التصميم الجديد'

interface Face {
  name: string
  fontWeight: number
  italic: boolean
  fontStyle: string
}

const FACES: Face[] = [
  { name: 'regular', fontWeight: 400, italic: false, fontStyle: 'Regular' },
  { name: 'medium', fontWeight: 500, italic: false, fontStyle: 'Medium' },
  { name: 'bold', fontWeight: 700, italic: false, fontStyle: 'Bold' },
  { name: 'italic', fontWeight: 400, italic: true, fontStyle: 'Italic' }
]

const SPACINGS: TextLength[] = [
  percent(-8),
  pixels(-1),
  pixels(0),
  percent(2),
  pixels(0.5),
  percent(12),
  pixels(3)
]

const FONT_SIZES = [11, 16, 40]

const LINE_HEIGHTS: Array<TextLength | null> = [null, percent(140), pixels(24)]

const BOXED_RESIZES = ['HEIGHT', 'NONE'] as const

function uniformCases(): Case[] {
  const cases: Case[] = []
  for (const [faceIndex, face] of FACES.entries()) {
    for (const [spacingIndex, letterSpacing] of SPACINGS.entries()) {
      for (const fontSize of FONT_SIZES) {
        const lineHeight = LINE_HEIGHTS[(faceIndex + spacingIndex) % LINE_HEIGHTS.length]
        const textCase = spacingIndex % 2 === 0 ? 'ORIGINAL' : 'UPPER'
        cases.push({
          label: `${face.name} ${lengthLabel(letterSpacing)} ${fontSize}px ${textCase}`,
          props: { ...face, text: TEXT, letterSpacing, fontSize, lineHeight, textCase }
        })
      }
    }
  }
  return cases
}

function runCases(): Case[] {
  const lastWord = (style: CharacterStyleOverride): StyleRun[] => [{ start: 9, length: 2, style }]
  const whole = (style: CharacterStyleOverride): StyleRun[] => [{ start: 0, length: 11, style }]
  return [
    {
      label: 'base 10%, last run unspaced',
      props: {
        text: TEXT,
        letterSpacing: percent(10),
        styleRuns: lastWord({ letterSpacing: percent(0) })
      }
    },
    {
      label: 'spacing only on a run covering the text',
      props: { text: TEXT, styleRuns: whole({ letterSpacing: percent(10) }) }
    },
    {
      label: 'percent spacing with a larger last run',
      props: { text: TEXT, letterSpacing: percent(10), styleRuns: lastWord({ fontSize: 32 }) }
    },
    {
      label: 'base negative, last run positive',
      props: {
        text: TEXT,
        letterSpacing: percent(-6),
        styleRuns: lastWord({ letterSpacing: percent(8) })
      }
    },
    {
      label: 'base positive, first run negative',
      props: {
        text: TEXT,
        letterSpacing: pixels(2),
        styleRuns: [{ start: 0, length: 4, style: { letterSpacing: pixels(-1) } }]
      }
    }
  ]
}

const CASES = [...uniformCases(), ...runCases()]
const LABELLED = CASES.map((testCase) => [testCase.label, testCase] as const)

const BY_ALIGN = CASES.flatMap((testCase) =>
  ALIGNS.map((align) => [testCase.label, align, testCase] as const)
)
const BY_RESIZE = CASES.flatMap((testCase) =>
  BOXED_RESIZES.map((resize) => [testCase.label, resize, testCase] as const)
)

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

describe('a line fits, wraps, truncates and aligns by its glyphs', () => {
  test.each(LABELLED)('%s: auto width sizes the box to its glyphs', (_, { props }) => {
    const glyphs = glyphsWidth(props)
    const measured = expectDefined(measureTextAsDrawn(renderer(), text(props)), 'size')
    expect(measured.width).toBe(Math.ceil(glyphs - EPSILON))
    expect(lineCount(props)).toBe(1)
    expect(lineCount({ ...props, width: measured.width })).toBe(1)
  })

  test.each(
    SPACINGS.flatMap((letterSpacing) =>
      FONT_SIZES.map((fontSize) => [fontSize, lengthLabel(letterSpacing), letterSpacing] as const)
    )
  )(
    '%dpx, %s: auto width keeps glyphs a whole number of pixels wide at that width',
    (fontSize, _, letterSpacing) => {
      const props = { text: EM_WIDE, fontSize, letterSpacing }
      expect(glyphsWidth(props)).toBeCloseTo(fontSize, 4)
      expect(measureTextAsDrawn(renderer(), text(props))?.width).toBe(fontSize)
    }
  )

  test.each(BY_ALIGN)(
    '%s, %s: auto width puts its glyphs where the alignment puts them',
    (_, textAlignHorizontal, { props }) => {
      const glyphs = glyphsWidth(props)
      const width = expectDefined(measureTextAsDrawn(renderer(), text(props)), 'size').width
      const aligned = { ...props, width, textAlignHorizontal }
      const layout = laidOut(aligned)
      const [line] = spans(aligned, layout)
      layout.delete()
      const free = width - glyphs
      const expectedStart = { LEFT: 0, JUSTIFIED: 0, CENTER: free / 2, RIGHT: free }
      expect(line.start).toBeCloseTo(expectedStart[textAlignHorizontal], 2)
      expect(line.end).toBeLessThanOrEqual(width + EPSILON)
    }
  )

  test.each(BY_RESIZE)(
    '%s, %s: truncates only when its glyphs do not fit',
    (_, textAutoResize, { props }) => {
      const glyphs = glyphsWidth(props)
      const truncated = (width: number) => {
        const layout = laidOut({
          ...props,
          width,
          textAutoResize,
          textTruncation: 'ENDING',
          maxLines: 1
        })
        const exceeded = layout.didExceedMaxLines()
        layout.delete()
        return exceeded
      }
      expect(truncated(glyphs + EPSILON)).toBe(false)
      expect(truncated(glyphs - EPSILON)).toBe(true)
    }
  )

  test.each(BY_RESIZE)(
    '%s, %s: wraps only when its glyphs do not fit',
    (_, textAutoResize, { props }) => {
      const glyphs = glyphsWidth(props)
      expect(lineCount({ ...props, width: glyphs + EPSILON, textAutoResize })).toBe(1)
      expect(lineCount({ ...props, width: glyphs - EPSILON, textAutoResize })).toBe(2)
    }
  )

  test.each(BY_ALIGN)(
    '%s, %s: truncated to one line, puts its glyphs and ellipsis inside the box',
    (_, textAlignHorizontal, { props }) => {
      const width = Math.round(glyphsWidth(props) * 0.6) + 0.5
      const layout = laidOut({
        ...props,
        width,
        textAutoResize: 'HEIGHT',
        textAlignHorizontal,
        textTruncation: 'ENDING',
        maxLines: 1
      })
      const line = truncatedSpan(expectDefined(layout.getShapedLines()[0], 'line'))
      expect(layout.didExceedMaxLines()).toBe(true)
      layout.delete()
      const free = width - (line.end - line.start)
      const expectedStart = { LEFT: 0, JUSTIFIED: 0, CENTER: free / 2, RIGHT: free }
      expect(line.start).toBeCloseTo(expectedStart[textAlignHorizontal], 2)
      expect(line.end).toBeLessThanOrEqual(width + EPSILON)
    }
  )

  test.each(BY_ALIGN)(
    '%s, %s: a wider box puts its glyphs where the alignment puts them',
    (_, textAlignHorizontal, { props }) => {
      const glyphs = glyphsWidth(props)
      const width = Math.ceil(glyphs) + MARGIN
      const aligned = { ...props, width, textAutoResize: 'HEIGHT' as const, textAlignHorizontal }
      const layout = laidOut(aligned)
      const [line] = spans(aligned, layout)
      layout.delete()
      const free = width - glyphs
      const expectedStart = { LEFT: 0, JUSTIFIED: 0, CENTER: free / 2, RIGHT: free }
      expect(line.start).toBeCloseTo(expectedStart[textAlignHorizontal], 2)
      expect(line.end - line.start).toBeCloseTo(glyphs, 2)
    }
  )
})

describe('wrapped and truncated lines break by their glyphs and align as Figma aligns them', () => {
  const firstWords = 'Settings and'
  const afterFirstWord = (style: CharacterStyleOverride): StyleRun[] => [
    { start: 8, length: WORDS.length - 8, style }
  ]
  const spacings: Case[] = SPACINGS.map((letterSpacing) => ({
    label: lengthLabel(letterSpacing),
    props: { text: WORDS, letterSpacing }
  }))
  const mixedRuns: Case[] = [
    {
      label: 'spaced first word',
      props: {
        text: WORDS,
        styleRuns: [{ start: 0, length: 8, style: { letterSpacing: percent(20) } }]
      }
    },
    {
      label: 'spaced after the first word',
      props: { text: WORDS, styleRuns: afterFirstWord({ letterSpacing: percent(20) }) }
    },
    {
      label: 'negative after the first word',
      props: {
        text: WORDS,
        letterSpacing: percent(10),
        styleRuns: afterFirstWord({ letterSpacing: percent(-8) })
      }
    }
  ]
  const rows = [...spacings, ...mixedRuns].flatMap((testCase) =>
    ALIGNS.flatMap((align) =>
      BOXED_RESIZES.map((resize) => [testCase.label, align, resize, testCase] as const)
    )
  )

  test.each(rows)('%s, %s, %s', (_, textAlignHorizontal, textAutoResize, { props }) => {
    const width = glyphsWidth({ ...props, text: firstWords }) + EPSILON
    const box = { ...props, width, textAutoResize, textAlignHorizontal }
    const wrapped = laidOut(box)
    const lines = figmaLines(box, wrapped)
    const firstLine = expectDefined(wrapped.getShapedLines()[0], 'line')
    wrapped.delete()
    expect(lines.length).toBeGreaterThan(1)
    expect(firstLine.textRange.last).toBeGreaterThanOrEqual(firstWords.length)
    expect(firstLine.textRange.last).toBeLessThanOrEqual(`${firstWords} `.length)
    expectFigmaLines(textAlignHorizontal, lines, width)

    const capped = laidOut({ ...box, textTruncation: 'ENDING', maxLines: 2 })
    expect(capped.didExceedMaxLines()).toBe(true)
    expect(capped.getLineMetrics()).toHaveLength(2)
    const [cappedFirst] = figmaLines(box, capped)
    const ellipsisLine = truncatedSpan(expectDefined(capped.getShapedLines()[1], 'line'))
    capped.delete()
    expectFigmaLines(textAlignHorizontal, [cappedFirst], width)
    expectEllipsisLine(textAlignHorizontal, ellipsisLine, width)
  })
})

function glyphPositions(layout: TextLayout): number[] {
  return layout
    .getShapedLines()
    .flatMap((line) =>
      line.runs.flatMap((run) => [...run.positions].filter((_, index) => index % 2 === 0))
    )
}

describe('a script Skia sets without letter spacing', () => {
  const arabic: Props = { text: ARABIC, fontFamily: ARABIC_FAMILY, textDirection: 'RTL' }

  test.each(ALIGNS.map((align) => [align] as const))(
    'Arabic, %s: lays out with letter spacing as without it',
    (textAlignHorizontal) => {
      for (const width of [90, 150, 230]) {
        const box: Props = { ...arabic, width, textAutoResize: 'HEIGHT', textAlignHorizontal }
        const spaced = laidOut({ ...box, letterSpacing: percent(10) })
        const plain = laidOut({ ...box, letterSpacing: pixels(0) })
        const drawn = glyphPositions(spaced)
        const expected = glyphPositions(plain)
        spaced.delete()
        plain.delete()
        expect(drawn).toHaveLength(expected.length)
        for (const [index, x] of drawn.entries()) {
          expect(x).toBeCloseTo(expected[index], 2)
        }
        expect(minOf(drawn)).toBeGreaterThanOrEqual(-EPSILON)
        expect(maxOf(drawn)).toBeLessThanOrEqual(width + EPSILON)
      }
    }
  )

  test('Arabic: auto width is as wide as without letter spacing', () => {
    const spaced = measureTextAsDrawn(renderer(), text({ ...arabic, letterSpacing: percent(10) }))
    const plain = measureTextAsDrawn(renderer(), text({ ...arabic, letterSpacing: pixels(0) }))
    expect(spaced?.width).toBe(expectDefined(plain, 'size').width)
  })
})

test('a list marker keeps one distance from its text in every alignment', () => {
  const gaps = (textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT', letterSpacing: TextLength) => {
    const layout = laidOut({
      text: 'First item here\nSecond item',
      width: 200,
      textAutoResize: 'HEIGHT',
      textAlignHorizontal,
      letterSpacing,
      textParagraphs: [
        { listType: 'UNORDERED', indentation: 1 },
        { listType: 'ORDERED', indentation: 1 }
      ]
    })
    const starts = layout.getShapedLines().map((line) => line.runs[0].positions[0])
    const xs = layout.getMarkers().map((marker, index) => starts[index] - marker.x)
    layout.delete()
    return xs
  }
  for (const spacing of [pixels(0), percent(20), pixels(-2)]) {
    const left = gaps('LEFT', spacing)
    expect(left).toHaveLength(2)
    for (const align of ['CENTER', 'RIGHT'] as const) {
      for (const [index, gap] of gaps(align, spacing).entries()) {
        expect(gap).toBeCloseTo(left[index], 4)
      }
    }
  }
})
