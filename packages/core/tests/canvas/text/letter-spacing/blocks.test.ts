import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  UNBOUNDED,
  type Props
} from '#core-tests/helpers/text/letter-spacing'
import { range } from 'es-toolkit'

import type { TextLayout } from '#core/canvas/text/layout'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

const WRAPPING = 'words to wrap here at three hundred pixels'
const CENTRED: Props = {
  text: '',
  width: 300,
  textAutoResize: 'HEIGHT',
  textAlignHorizontal: 'CENTER',
  letterSpacing: percent(4)
}

function paragraphs(count: number, at: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => at(index)).join('\n')
}

/** The same text kept in one native paragraph: a style run leaves it out of blocks. */
function asOneParagraph(props: Props): Props {
  return {
    ...props,
    styleRuns: [{ start: 0, length: props.text.length, style: { fontSize: 16 } }]
  }
}

function caretXs(layout: TextLayout, from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, offset) => {
    return layout.getCaretRect(from + offset, false)?.x ?? Number.NaN
  })
}

describe('a long joined text laid out in blocks', () => {
  test('a block starting in hebrew keeps the direction of the whole text', () => {
    const texts = Array.from({ length: 260 }, (_, index) =>
      index === 128 ? `שלום עולם paragraph ${index} ${WRAPPING}` : `Paragraph ${index} ${WRAPPING}`
    )
    const props = { ...CENTRED, text: texts.join('\n') }
    const blocks = laidOut(props)
    const one = laidOut(asOneParagraph(props))
    const start = texts.slice(0, 128).join('\n').length + 1
    const end = start + texts[128].length
    expect(blocks.blocks.length).toBeGreaterThan(1)
    const oneCarets = caretXs(one, start, end)
    for (const [offset, x] of caretXs(blocks, start, end).entries()) {
      expect(x).toBeCloseTo(oneCarets[offset], 1)
    }
    blocks.delete()
    one.delete()
  })

  test.each([
    ['one blank line', '\n\n', 5],
    ['two blank lines', '\n\n\n', 7]
  ] as const)(
    'paragraphs split by %s split into blocks laid out as one paragraph',
    (_, separator, expectedBlocks) => {
      const text = Array.from({ length: 260 }, (_, index) => `Paragraph ${index} ${WRAPPING}`).join(
        separator
      )
      const props = { ...CENTRED, text }
      const blocks = laidOut(props)
      const one = laidOut(asOneParagraph(props))
      const lines = (layout: TextLayout) =>
        layout
          .getLineMetrics()
          .map((line) => [line.startIndex, line.endIndex, line.left, line.baseline, line.height])
      const nearSeams = blocks.blocks.slice(1).flatMap(({ start }) => range(start - 40, start + 40))
      const caretBoxes = (layout: TextLayout) =>
        nearSeams.map((index) => {
          const caret = layout.getCaretRect(index, false)
          return caret ? [caret.x, caret.top, caret.bottom] : []
        })
      const blockCount = blocks.blocks.length
      const [blockLines, oneLines] = [lines(blocks), lines(one)]
      const [blockCarets, oneCarets] = [caretBoxes(blocks), caretBoxes(one)]
      blocks.delete()
      one.delete()
      expect(blockCount).toBe(expectedBlocks)
      expect(blockLines).toHaveLength(oneLines.length)
      for (const [index, line] of oneLines.entries()) {
        expect(blockLines[index][0]).toBe(line[0])
        expect(blockLines[index][1]).toBe(line[1])
        for (const field of [2, 3, 4]) {
          expect(blockLines[index][field]).toBeCloseTo(line[field], 1)
        }
      }
      for (const [index, caret] of oneCarets.entries()) {
        expect(blockCarets[index]).toHaveLength(caret.length)
        for (const [field, value] of caret.entries()) {
          expect(blockCarets[index][field]).toBeCloseTo(value, 1)
        }
      }
    }
  )

  test('a text built before its width is known joins in blocks once it wraps', () => {
    const text = paragraphs(300, (index) => `Paragraph ${index} ${WRAPPING}`)
    const built = laidOut({ ...CENTRED, text, width: UNBOUNDED })
    const direct = laidOut({ ...CENTRED, text })
    built.layout(300)
    expect(built.blocks.length).toBe(direct.blocks.length)
    expect(built.blocks.length).toBeGreaterThan(1)
    const lines = (layout: TextLayout) =>
      layout.getLineMetrics().map((line) => [line.startIndex, line.endIndex, line.left])
    const builtLines = lines(built)
    for (const [index, line] of lines(direct).entries()) {
      expect(builtLines[index][0]).toBe(line[0])
      expect(builtLines[index][1]).toBe(line[1])
      expect(builtLines[index][2]).toBeCloseTo(line[2], 2)
    }
    built.delete()
    direct.delete()
  })
})

describe('paragraphs laid out apart fit their lines apart', () => {
  test('a paragraph whose last word has no spacing wraps no other paragraph sooner', () => {
    const heading = 'Mixed spacing heading words'
    const body = 'Second paragraph with wide letter spacing here'
    const styleRuns = [
      { start: heading.indexOf('words'), length: 5, style: { letterSpacing: pixels(0) } }
    ]
    const spaced = { textAutoResize: 'HEIGHT' as const, letterSpacing: pixels(4) }
    const lineCount = (props: Props) => {
      const layout = laidOut(props)
      const count = layout.getLineMetrics().length
      layout.delete()
      return count
    }
    for (let width = 60; width < 420; width++) {
      const together = lineCount({
        ...spaced,
        text: `${heading}\n${body}`,
        width,
        paragraphSpacing: 6,
        styleRuns
      })
      const apart =
        lineCount({ ...spaced, text: heading, width, styleRuns }) +
        lineCount({ ...spaced, text: body, width })
      expect(together).toBe(apart)
    }
  })
})
