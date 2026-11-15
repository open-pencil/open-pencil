import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  canvasKit,
  EPSILON,
  laidOut,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import { maxOf, minOf } from '@open-pencil/scene-graph/arrays'
import { expectDefined } from '@open-pencil/test-support/assert'

import type { TextLayout } from '#core/canvas/text/layout'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

const UNBOUNDED_WIDTH = { width: 400, textAutoResize: 'WIDTH_AND_HEIGHT' as const }

function lastLine(layout: TextLayout) {
  return expectDefined(layout.getLineMetrics().at(-1), 'line')
}

function lastLineWidth(props: Props): number {
  const layout = laidOut(props)
  const width = lastLine(layout).width
  layout.delete()
  return width
}

describe('style runs', () => {
  test('a spacing run over half an emoji is left out, as the paragraph leaves it', () => {
    const props: Props = { text: 'ab😀c', letterSpacing: pixels(0), ...UNBOUNDED_WIDTH }
    const split = lastLineWidth({
      ...props,
      styleRuns: [{ start: 3, length: 1, style: { letterSpacing: pixels(10) } }]
    })
    expect(split).toBeCloseTo(lastLineWidth(props), 2)
  })

  test('overlapping runs count the characters they cover once', () => {
    const run = { start: 0, length: 4, style: { letterSpacing: pixels(0) } }
    const props: Props = { text: 'abcdefgh', letterSpacing: pixels(6), ...UNBOUNDED_WIDTH }
    const once = lastLineWidth({ ...props, styleRuns: [run] })
    expect(lastLineWidth({ ...props, styleRuns: [run, run] })).toBeCloseTo(once, 2)
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
      expect(minOf(xs)).toBeGreaterThanOrEqual(-EPSILON)
      expect(maxOf(xs) - spacing).toBeLessThanOrEqual(box + EPSILON)
      layout.delete()
    }
  )

  test.each([
    ['CENTER', percent(4)],
    ['RIGHT', pixels(8)]
  ] as const)(
    'a click on a glyph of a wrapped line’s last hebrew word, %s, lands on it',
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
