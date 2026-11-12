import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  renderer,
  SENTENCE,
  text,
  UNBOUNDED,
  type Case,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import { maxOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { TextLayout } from '#core/canvas/text/layout'
import {
  JOINER,
  JoinerIndex,
  lineEndJoiners,
  type JoinerUnits
} from '#core/canvas/text/paragraph/joiners'
import { shapeText } from '#core/canvas/text/shape'
import { EMOJI_METRICS_FAMILY } from '#core/text/emoji'
import { fontManager } from '#core/text/font/manager'
import { utf8Length } from '#core/text/utf8'

beforeAll(async () => {
  await loadSpacedTextFonts()
  const emoji = await fontManager.fetchBundledFont('/OpenPencilEmojiMetrics-Regular.ttf')
  await fontManager.markLoaded(EMOJI_METRICS_FAMILY, 'Regular', expectDefined(emoji, 'emoji'))
})
afterAll(releaseSpacedTextFonts)

const WIDTH = 133
const FAR = 1e4

const CASES: Case[] = [
  { label: 'one paragraph', props: { text: SENTENCE, letterSpacing: pixels(3) } },
  {
    label: 'hard lines ending in spaces',
    props: { text: 'Settings and  \nmore options \nfor everyone ', letterSpacing: percent(10) }
  },
  {
    label: 'ending in a newline',
    props: { text: 'Settings and more\n', letterSpacing: pixels(2) }
  },
  {
    label: 'ending in an emoji',
    props: { text: 'Settings and more 👍', letterSpacing: pixels(2) }
  },
  {
    label: 'ending in a no-break space',
    props: { text: 'Settings and\u00A0', letterSpacing: pixels(2) }
  },
  {
    label: 'paragraphs laid out apart',
    props: {
      text: 'Settings and more\nOptions for everyone',
      letterSpacing: pixels(3),
      paragraphSpacing: 6
    }
  },
  { label: 'negative spacing', props: { text: SENTENCE, letterSpacing: percent(-8) } },
  {
    label: 'a wrapped paragraph ending in a fallback glyph',
    props: { text: 'Settings and more ก \nfor everyone', letterSpacing: pixels(4) }
  },
  {
    label: 'a style run splitting an emoji',
    props: {
      text: 'Settings and 👍 more options  ',
      letterSpacing: pixels(4),
      styleRuns: [{ start: 14, length: 4, style: { fontSize: 20 } }]
    }
  }
]

const ALIGNED = ['CENTER', 'RIGHT'] as const
const rows = CASES.flatMap((testCase) =>
  ALIGNED.map((align) => [testCase.label, align, testCase] as const)
)

function boxed(props: Props, textAlignHorizontal: 'LEFT' | (typeof ALIGNED)[number]): Props {
  return { ...props, width: WIDTH, height: 400, textAutoResize: 'HEIGHT', textAlignHorizontal }
}

/** The text laid out aligned, and left-aligned, which takes no joiners, to answer alike. */
function bothAligned(props: Props, align: (typeof ALIGNED)[number]): [TextLayout, TextLayout] {
  return [laidOut(boxed(props, align)), laidOut(boxed(props, 'LEFT'))]
}

function glyphOffsets(layout: TextLayout): number[] {
  return layout
    .getShapedLines()
    .flatMap((line) =>
      line.runs.flatMap((run) => Array.from(run.offsets.subarray(0, run.glyphs.length)))
    )
}

function lineIndices(layout: TextLayout) {
  return layout.getLineMetrics().map((line) => ({
    start: line.startIndex,
    end: line.endIndex,
    endExcludingWhitespaces: line.endExcludingWhitespaces,
    endIncludingNewline: line.endIncludingNewline,
    isHardBreak: line.isHardBreak,
    ascent: line.ascent,
    descent: line.descent,
    baseline: line.baseline
  }))
}

function lastGlyphEnd(layout: TextLayout): number {
  const runs = layout.getShapedLines().findLast((line) => line.runs.length > 0)?.runs ?? []
  return maxOf(runs.map((run) => run.positions[2 * run.glyphs.length]))
}

describe('joiners that align hard line ends stay out of everything the text answers', () => {
  test.each(rows)('%s, %s: glyphs and lines are the text’s own', (_, align, { props }) => {
    const [layout, left] = bothAligned(props, align)
    expect(glyphOffsets(layout)).toEqual(glyphOffsets(left))
    expect(lineIndices(layout)).toEqual(lineIndices(left))
    for (let index = 0; index <= props.text.length + 1; index++) {
      expect(layout.getLineNumberAt(index)).toBe(left.getLineNumberAt(index))
      const caret = layout.getCaretRect(index, false)
      const leftCaret = left.getCaretRect(index, false)
      expect(caret && { top: caret.top, bottom: caret.bottom }).toEqual(
        leftCaret && { top: leftCaret.top, bottom: leftCaret.bottom }
      )
    }
    layout.delete()
    left.delete()
  })

  test.each(rows)(
    '%s, %s: a click past a line lands where it does unaligned',
    (_, align, { props }) => {
      const [layout, left] = bothAligned(props, align)
      for (const line of layout.getShapedLines()) {
        for (const x of [-FAR, FAR]) {
          const hit = layout.getGlyphPositionAtCoordinate(x, line.baseline)
          const leftHit = left.getGlyphPositionAtCoordinate(x, line.baseline)
          expect(hit.pos).toBe(leftHit.pos)
        }
      }
      layout.delete()
      left.delete()
    }
  )

  test.each(rows)('%s, %s: selecting the whole text covers its glyphs', (_, align, { props }) => {
    const layout = laidOut(boxed(props, align))
    const { ck } = renderer()
    const rects = layout.getRectsForRange(
      0,
      props.text.length,
      ck.RectHeightStyle.Tight,
      ck.RectWidthStyle.Tight
    )
    for (const { rect } of rects) {
      expect(rect[2]).toBeGreaterThanOrEqual(rect[0])
    }
    const right = maxOf(rects.map(({ rect }) => rect[2]))
    expect(right).toBeGreaterThanOrEqual(lastGlyphEnd(layout) - 0.01)
    layout.delete()
  })

  test.each(rows)(
    '%s, %s: saved glyphs and baselines are the text’s own',
    (_, align, { props }) => {
      const { ck } = renderer()
      const fontProvider = expectDefined(renderer().fontProvider, 'font provider')
      const node = text(boxed(props, align))
      const shaped = shapeText(ck, fontProvider, node)
      const left = shapeText(ck, fontProvider, text(boxed(props, 'LEFT')))
      const characters = (saved: typeof shaped) =>
        saved?.glyphs.map((glyph) => glyph.firstCharacter)
      const advances = (saved: typeof shaped) => saved?.glyphs.map((glyph) => glyph.advance) ?? []
      const lines = (saved: typeof shaped) =>
        saved?.baselines.map(({ firstCharacter, endCharacter }) => [firstCharacter, endCharacter])
      expect(characters(shaped)).toEqual(characters(left))
      const leftAdvances = advances(left)
      for (const [index, advance] of advances(shaped).entries()) {
        expect(advance).toBeCloseTo(leftAdvances[index], 1)
      }
      expect(lines(shaped)).toEqual(lines(left))
    }
  )
})

describe('a truncated hard line ending in a fallback glyph', () => {
  const box = 140
  const centredEnds = [
    ['👍', 118.688],
    ['本', 115.938],
    ['ok', 120.273],
    ['שלום', 132.648]
  ] as const
  const endRows = centredEnds.flatMap(([end, centred]) => [
    ['CENTER', end, centred] as const,
    ['RIGHT', end, box] as const
  ])
  test.each(endRows)(
    '%s, ending in %s: its glyphs and caret end where Figma aligns them',
    (align, end, expectedEnd) => {
      const props: Props = {
        text: `Thanks for the great job ${end}\nsecond line hidden`,
        letterSpacing: percent(6),
        maxLines: 2,
        textTruncation: 'ENDING',
        width: box,
        textAutoResize: 'HEIGHT',
        textAlignHorizontal: align
      }
      const joined = laidOut({ ...props, width: 0.5 })
      joined.layout(box)
      const lines = joined.getLineMetrics()
      const caret = expectDefined(
        joined.getCaretRect(expectDefined(lines.at(-1), 'line').endIndex, false),
        'caret'
      )
      const glyphEnd = lastGlyphEnd(joined)
      joined.delete()
      expect(lines).toHaveLength(2)
      expect(glyphEnd).toBeCloseTo(expectedEnd, 2)
      expect(glyphEnd).toBeLessThanOrEqual(box + 0.01)
      expect(caret.x).toBeCloseTo(expectedEnd, 2)
    }
  )
})

const GUESSED_TEXTS = [
  'Hello world',
  'Settings and more options for everyone',
  'Short\nA much longer second line that wraps around here',
  'Great job 👍 \nnext line here ok',
  'He 本 語 \nx y z',
  'one two three four five six seven eight\n\nnine ten',
  'Supercalifragilisticexpialidocious word',
  'Done ✓\nGreat job 👍',
  'trailing  '
]

const GUESSED_STYLES: Array<[string, Partial<Props>]> = [
  ['centred 4%', { textAlignHorizontal: 'CENTER', letterSpacing: percent(4) }],
  ['right 8px', { textAlignHorizontal: 'RIGHT', letterSpacing: pixels(8) }],
  ['centred -5%', { textAlignHorizontal: 'CENTER', letterSpacing: percent(-5) }],
  [
    'centred with a spaced run',
    {
      textAlignHorizontal: 'CENTER',
      letterSpacing: percent(4),
      styleRuns: [{ start: 2, length: 4, style: { letterSpacing: percent(20), fontSize: 22 } }]
    }
  ],
  [
    'right, two lines at most',
    {
      textAlignHorizontal: 'RIGHT',
      letterSpacing: percent(6),
      maxLines: 2,
      textTruncation: 'ENDING'
    }
  ],
  [
    'centred with paragraph spacing',
    { textAlignHorizontal: 'CENTER', letterSpacing: percent(6), paragraphSpacing: 5 }
  ],
  [
    'centred with a first-line indent',
    { textAlignHorizontal: 'CENTER', letterSpacing: percent(6), paragraphIndent: 12 }
  ]
]

const GUESSED_WIDTHS = [60, 140, 330]
const PLACE = 0.02

function answers(layout: TextLayout, value: string) {
  const { ck } = renderer()
  const lines = layout.getLineMetrics().map((line) => ({
    start: line.startIndex,
    end: line.endIndex,
    left: line.left,
    width: line.width,
    baseline: line.baseline
  }))
  const carets = Array.from(
    { length: value.length + 1 },
    (_, index) => layout.getCaretRect(index, false)?.x ?? Number.NaN
  )
  const boxes = Array.from({ length: value.length }, (_, index) =>
    layout
      .getRectsForRange(index, index + 1, ck.RectHeightStyle.Tight, ck.RectWidthStyle.Tight)
      .map(({ rect }) => rect[2] - rect[0])
      .reduce((sum, width) => sum + width, 0)
  )
  const glyphs = layout
    .getShapedLines()
    .flatMap((line) =>
      line.runs.flatMap((run) => Array.from(run.positions.filter((_, index) => index % 2 === 0)))
    )
  const hits: number[] = []
  for (let y = 2; y < layout.getHeight(); y += 9) {
    for (let x = -5; x < 340; x += 7) {
      hits.push(layout.getGlyphPositionAtCoordinate(x, y).pos)
    }
  }
  return {
    lines,
    carets,
    boxes,
    glyphs,
    hits,
    longest: layout.getLongestLine(),
    height: layout.getHeight()
  }
}

function expectClose(actual: readonly number[], expected: readonly number[]): void {
  expect(actual.length).toBe(expected.length)
  for (const [index, value] of actual.entries()) {
    expect(
      Math.abs(value - expected[index]) < PLACE ||
        (Number.isNaN(value) && Number.isNaN(expected[index]))
    ).toBe(true)
  }
}

describe('a text built before its width is known lays out as one built for that width', () => {
  const rows = GUESSED_STYLES.flatMap(([label, style]) =>
    GUESSED_TEXTS.map((value) => [label, value, style] as const)
  )
  test.each(rows)('%s: %j', (_, value, style) => {
    for (const width of GUESSED_WIDTHS) {
      const props: Props = { ...style, text: value, textAutoResize: 'HEIGHT' }
      const plainFirst = laidOut({ ...props, width: UNBOUNDED })
      const joinedFirst = laidOut({ ...props, width: 0.5 })
      plainFirst.layout(width)
      joinedFirst.layout(width)
      const plain = answers(plainFirst, value)
      const joined = answers(joinedFirst, value)
      expect(joined.lines.map(({ start, end }) => [start, end])).toEqual(
        plain.lines.map(({ start, end }) => [start, end])
      )
      expectClose(
        joined.lines.flatMap(({ left, width: lineWidth, baseline }) => [left, lineWidth, baseline]),
        plain.lines.flatMap(({ left, width: lineWidth, baseline }) => [left, lineWidth, baseline])
      )
      expectClose(joined.carets, plain.carets)
      expectClose(joined.boxes, plain.boxes)
      expectClose(joined.glyphs, plain.glyphs)
      expect(joined.hits).toEqual(plain.hits)
      expect(joined.longest).toBeCloseTo(plain.longest, 2)
      expect(joined.height).toBeCloseTo(plain.height, 2)
      plainFirst.delete()
      joinedFirst.delete()
    }
  })
})

const CENTRED: Props = {
  text: '',
  width: 200,
  textAutoResize: 'HEIGHT',
  textAlignHorizontal: 'CENTER',
  letterSpacing: percent(4)
}

function wrappingParagraphs(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${SENTENCE.slice(0, 20 + ((index * 7) % 37))} ${index}`
  )
}

function shortLines(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `Item ${index}`)
}

function nativeParagraphs(props: Props): { blocks: number; joined: number } {
  const layout = laidOut(props)
  const blocks = layout.blocks.length
  const joined = layout.blocks.filter((block) => block.joiners.count > 0).length
  layout.delete()
  return { blocks, joined }
}

describe('how many native paragraphs a centred spaced text takes', () => {
  test.each([
    ['short lines, never wrapping', shortLines(300), { blocks: 1, joined: 0 }],
    ['100 wrapping paragraphs', wrappingParagraphs(100), { blocks: 1, joined: 1 }],
    ['200 wrapping paragraphs', wrappingParagraphs(200), { blocks: 1, joined: 1 }],
    ['230 wrapping paragraphs', wrappingParagraphs(230), { blocks: 2, joined: 2 }],
    ['600 wrapping paragraphs', wrappingParagraphs(600), { blocks: 5, joined: 5 }],
    [
      '230 wrapping paragraphs ending in hebrew',
      wrappingParagraphs(230).map((paragraph) => `${paragraph} שלום 12`),
      { blocks: 2, joined: 2 }
    ]
  ])('%s', (_, paragraphs, expected) => {
    expect(nativeParagraphs({ ...CENTRED, text: paragraphs.join('\n') })).toEqual(expected)
  })

  test('a carriage return never ends a group, so its box and caret stay as in one paragraph', () => {
    const text = wrappingParagraphs(600)
      .map((paragraph, index) => (index % 3 === 0 ? `${paragraph}\n` : `${paragraph}\r\n`))
      .join('')
    const layout = laidOut({ ...CENTRED, text })
    expect(layout.blocks.length).toBeGreaterThan(1)
    for (const block of layout.blocks.slice(0, -1)) {
      expect(text[block.start + block.length - 1]).not.toBe('\r')
    }
    layout.delete()
  })

  test('a list item ending in a hebrew word keeps the caret it has laid out alone', () => {
    const items = wrappingParagraphs(230).map((paragraph) => `${paragraph} שלום עולם`)
    const bulleted = (text: string, count: number): Props => ({
      ...CENTRED,
      text,
      textParagraphs: Array.from({ length: count }, () => ({
        listType: 'UNORDERED' as const,
        indentation: 1
      }))
    })
    const layout = laidOut(bulleted(items.join('\n'), items.length))
    expect(layout.blocks.length).toBe(items.length)
    expect(layout.blocks.some((block) => block.endsAtSeam)).toBe(false)
    let end = -1
    for (const item of items) {
      end += item.length + 1
      const alone = laidOut(bulleted(item, 1))
      const caret = expectDefined(layout.getCaretRect(end, false), 'caret')
      expectClose([caret.x], [expectDefined(alone.getCaretRect(item.length, false), 'caret').x])
      alone.delete()
    }
    layout.delete()
  })

  test('the caret after a group ending in a hebrew word sits where it does before a newline', () => {
    const paragraphs = wrappingParagraphs(301).map((paragraph, index) =>
      index % 2 === 1 ? `${paragraph} שלום עולם` : paragraph
    )
    const layout = laidOut({ ...CENTRED, text: paragraphs.join('\n') })
    expect(layout.blocks.length).toBe(3)
    let end = -1
    for (const paragraph of paragraphs) {
      end += paragraph.length + 1
      const followed = laidOut({ ...CENTRED, text: `${paragraph}\n` })
      const caret = expectDefined(layout.getCaretRect(end, false), 'caret')
      const expected = expectDefined(followed.getCaretRect(paragraph.length, false), 'caret')
      expectClose([caret.x], [expected.x])
      followed.delete()
    }
    layout.delete()
  })
})

describe('a long centred text joined in groups of paragraphs', () => {
  const paragraphs = wrappingParagraphs(230)
  const style: Props = { ...CENTRED, text: paragraphs.join('\n') }

  test('is laid out in more than one native paragraph', () => {
    expect(nativeParagraphs(style).blocks).toBeGreaterThan(1)
  })

  test('sets each paragraph’s lines where the paragraph alone has them, one under another', () => {
    const layout = laidOut(style)
    const lines = layout.getLineMetrics()
    let at = 0
    for (const paragraph of paragraphs) {
      const alone = laidOut({ ...style, text: paragraph })
      for (const line of alone.getLineMetrics()) {
        const placed = expectDefined(lines.at(at), 'line')
        expectClose([placed.left, placed.width], [line.left, line.width])
        at++
      }
      alone.delete()
    }
    expect(at).toBe(lines.length)
    const steps = lines.slice(1).map((line, index) => line.baseline - lines[index].baseline)
    expectClose(
      steps,
      steps.map(() => steps[0])
    )
    layout.delete()
  })

  test('keeps the caret and clicks on the paragraph’s own characters', () => {
    const layout = laidOut(style)
    let start = 0
    for (const paragraph of paragraphs) {
      const caret = expectDefined(layout.getCaretRect(start, false), 'caret')
      const line = expectDefined(layout.getLineMetrics()[layout.getLineNumberAt(start)], 'line')
      expectClose([caret.x], [line.left])
      const hit = layout.getGlyphPositionAtCoordinate(line.left - FAR, line.baseline)
      expect(hit.pos).toBe(start)
      start += paragraph.length + 1
    }
    layout.delete()
  })
})

describe('joiner offsets map between the text and its paragraph', () => {
  const sample = 'Settings 日本 \n\nmore 👍\r\nfor everyone  \nx'
  const joiners = lineEndJoiners(sample, () => 2)
  const index = JoinerIndex.of(sample, joiners)
  const paragraph = joiners.reduceRight(
    (built, joiner) => built.slice(0, joiner.at) + JOINER + built.slice(joiner.at),
    sample
  )

  function unitsOf(text: string, units: JoinerUnits): string[] {
    return units === 'utf16'
      ? text.split('')
      : [...text].flatMap((character) =>
          Array.from({ length: utf8Length(character) }, () => character)
        )
  }

  test.each(['utf16', 'utf8'] as const)(
    '%s offsets match the paragraph the joiners are in',
    (units) => {
      const cells = unitsOf(paragraph, units)
      const textCells = unitsOf(sample, units)
      let textAt = 0
      for (const [at, cell] of cells.entries()) {
        const joiner = cell === JOINER
        expect(index.joinerAt(at, units) !== undefined).toBe(joiner)
        expect(index.textOffset(at, units)).toBe(textAt)
        if (!joiner) {
          expect(index.characterOffset(textAt, units)).toBe(at)
          textAt++
        }
      }
      expect(textAt).toBe(textCells.length)
      expect(index.textOffset(cells.length, units)).toBe(textCells.length)
    }
  )
})
