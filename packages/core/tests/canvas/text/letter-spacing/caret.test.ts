import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  canvasKit,
  laidOut,
  lengthLabel,
  loadSpacedTextFonts,
  percent,
  pixels,
  releaseSpacedTextFonts,
  renderer,
  text,
  UNBOUNDED,
  type Props
} from '#core-tests/helpers/text/letter-spacing'

import { TextEditor } from '@open-pencil/core/text'
import type { SceneNode, TextLength } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { TextLayout } from '#core/canvas/text/layout'
import { buildParagraph } from '#core/canvas/text/layout/build'
import { shapeText } from '#core/canvas/text/shape'

beforeAll(loadSpacedTextFonts)
afterAll(releaseSpacedTextFonts)

const WIDTH = 200
const ALIGNS = ['LEFT', 'CENTER', 'RIGHT'] as const
const SPACINGS = [pixels(4), pixels(12), percent(10), percent(-5)]
const TEXTS = [
  'Hello',
  'Hello ',
  'Hello   ',
  'Hello\n',
  'Hello\n\n',
  'Hi there\nfoo  \nbar',
  'Settings and more options for everyone  ',
  'Hello ก',
  'Hello ก \nx',
  'Settings and more options ก \nx',
  'Settings and more ก  \nfor everyone ก',
  'Settings  \nmore\tand　\n'
]

type Align = (typeof ALIGNS)[number]

function boxed(textValue: string, align: Align, letterSpacing: TextLength): Props {
  return {
    text: textValue,
    letterSpacing,
    width: WIDTH,
    height: 400,
    textAutoResize: 'HEIGHT',
    textAlignHorizontal: align
  }
}

function caretXs(layout: TextLayout, length: number): { x: number; top: number }[] {
  return Array.from({ length: length + 1 }, (_, index) => {
    const caret = expectDefined(layout.getCaretRect(index, false), `caret ${index}`)
    return { x: caret.x, top: caret.top }
  })
}

function charRects(layout: TextLayout, length: number): { left: number; width: number }[] {
  const ck = canvasKit()
  return Array.from({ length }, (_, index) => {
    const rects = layout.getRectsForRange(
      index,
      index + 1,
      ck.RectHeightStyle.Tight,
      ck.RectWidthStyle.Tight
    )
    const left = Math.min(...rects.map(({ rect }) => rect[0]))
    const width = rects.reduce((sum, { rect }) => sum + rect[2] - rect[0], 0)
    return { left, width }
  })
}

/** How far each line of `layout` sits from the same line laid out left-aligned without spacing rules. */
function lineMoves(layout: TextLayout, reference: TextLayout, length: number): Map<number, number> {
  const carets = caretXs(layout, length)
  const references = caretXs(reference, length)
  const moves = new Map<number, number>()
  for (const line of layout.getLineMetrics()) {
    if (line.endExcludingWhitespaces > line.startIndex && line.width !== 0) {
      const index = line.startIndex
      moves.set(carets[index].top, carets[index].x - references[index].x)
    }
  }
  return moves
}

const rows = TEXTS.flatMap((textValue) =>
  ALIGNS.flatMap((align) =>
    SPACINGS.map(
      (spacing) =>
        [JSON.stringify(textValue), align, lengthLabel(spacing), textValue, spacing] as const
    )
  )
)

describe('the caret and selection keep their place against the glyphs in spaced text', () => {
  test.each(rows)('%s, %s %s: every caret moves with its line', (_, align, __, value, spacing) => {
    const layout = laidOut(boxed(value, align, spacing))
    const reference = laidOut(boxed(value, 'LEFT', spacing))
    const moves = lineMoves(layout, reference, value.length)
    const carets = caretXs(layout, value.length)
    const references = caretXs(reference, value.length)
    for (const [index, caret] of carets.entries()) {
      const move = moves.get(caret.top)
      if (move !== undefined) {
        expect(caret.x - references[index].x).toBeCloseTo(move, 2)
      }
    }
    layout.delete()
    reference.delete()
  })

  test.each(rows)(
    '%s, %s %s: each character’s selection is as wide as unaligned',
    (_, align, __, value, spacing) => {
      const layout = laidOut(boxed(value, align, spacing))
      const reference = laidOut(boxed(value, 'LEFT', spacing))
      const rects = charRects(layout, value.length)
      const referenceRects = charRects(reference, value.length)
      for (const [index, rect] of rects.entries()) {
        expect(rect.width).toBeCloseTo(referenceRects[index].width, 2)
        expect(rect.width).toBeGreaterThanOrEqual(0)
      }
      layout.delete()
      reference.delete()
    }
  )

  test.each(rows)(
    '%s, %s %s: a click lands where it does on the unaligned line',
    (_, align, __, value, spacing) => {
      const layout = laidOut(boxed(value, align, spacing))
      const reference = laidOut(boxed(value, 'LEFT', spacing))
      const moves = lineMoves(layout, reference, value.length)
      for (const [top, move] of moves) {
        const y = top + 4
        for (let x = -10; x <= WIDTH + 40; x += 0.5) {
          const hit = layout.getGlyphPositionAtCoordinate(x + move, y).pos
          expect(hit).toBe(reference.getGlyphPositionAtCoordinate(x, y).pos)
        }
      }
      layout.delete()
      reference.delete()
    }
  )
})

describe('typing at the end of spaced text', () => {
  const typed = ['Hello', 'Hello ', 'Hello  ', 'Hello w']
  test.each(
    ALIGNS.flatMap((align) =>
      SPACINGS.map((spacing) => [align, lengthLabel(spacing), spacing] as const)
    )
  )('%s %s: a typed space moves the caret by its advance', (align, _, spacing) => {
    const advances = (alignment: Align) =>
      typed.slice(1, 3).map((value) => {
        const layout = laidOut(boxed(value, alignment, spacing))
        const carets = caretXs(layout, value.length)
        layout.delete()
        return carets[value.length].x - carets[value.length - 1].x
      })
    const unaligned = advances('LEFT')
    for (const [index, advance] of advances(align).entries()) {
      expect(advance).toBeGreaterThan(0)
      expect(advance).toBeCloseTo(unaligned[index], 2)
    }
  })
})

describe('an empty last line after a line break', () => {
  const ends: Record<Align, number> = { LEFT: 0, CENTER: WIDTH / 2, RIGHT: WIDTH }
  const breaks = ['Hello\n', 'Hello \n', 'Hello\n\n'].flatMap((value) =>
    ALIGNS.flatMap((align) =>
      SPACINGS.map(
        (spacing) => [JSON.stringify(value), align, lengthLabel(spacing), value, spacing] as const
      )
    )
  )

  test.each(breaks)(
    '%s, %s %s: the caret after it starts where the box aligns',
    (_, align, __, value, spacing) => {
      const layout = laidOut(boxed(value, align, spacing))
      const caret = expectDefined(layout.getCaretRect(value.length, false), 'caret')
      expect(caret.x).toBeCloseTo(ends[align], 2)
      layout.delete()
    }
  )

  test.each(breaks)(
    '%s, %s %s: the saved line widths take no spacing off it',
    (_, align, __, value, spacing) => {
      const fontProvider = expectDefined(renderer().fontProvider, 'font provider')
      const shaped = expectDefined(
        shapeText(canvasKit(), fontProvider, text(boxed(value, align, spacing))),
        'shaped'
      )
      const last = expectDefined(shaped.baselines.at(-1), 'last baseline')
      expect(last.width).toBe(0)
      for (const baseline of shaped.baselines) {
        expect(baseline.width).toBeGreaterThanOrEqual(0)
      }
    }
  )
})

describe('up and down arrows keep the caret’s column in spaced text', () => {
  const lines = 'Hello  \nHello  '
  const lineLength = 8

  function editorOn(node: SceneNode): TextEditor {
    const editor = new TextEditor(canvasKit())
    editor.setRenderer(
      asDouble<Parameters<TextEditor['setRenderer']>[0]>({
        buildParagraph: (shown: SceneNode) => {
          const layout = buildParagraph(renderer(), shown)
          layout.layout(shown.width)
          return layout
        },
        fontGeneration: 1
      })
    )
    editor.start(node)
    return editor
  }

  test.each(
    ALIGNS.flatMap((align) =>
      SPACINGS.map((spacing) => [align, lengthLabel(spacing), spacing] as const)
    )
  )('%s %s: down from each caret of the first line lands under it', (align, _, spacing) => {
    const editor = editorOn(text(boxed(lines, align, spacing)))
    const state = expectDefined(editor.state, 'editor state')
    for (let index = 0; index < lineLength; index++) {
      state.selectionAnchor = null
      state.cursor = index
      editor.moveDown()
      expect(state.cursor).toBe(index + lineLength)
    }
    editor.stop()
  })
})

describe('a click on the empty line a first-line indent makes', () => {
  test.each(['CENTER', 'RIGHT'] as const)('%s: lands at the text’s start', (align) => {
    const props: Props = {
      text: 'trailing  ',
      textAlignHorizontal: align,
      letterSpacing: percent(6),
      paragraphIndent: 12,
      textAutoResize: 'HEIGHT'
    }
    for (const built of [0.5, UNBOUNDED]) {
      const layout = laidOut({ ...props, width: built })
      layout.layout(60)
      const indentLine = expectDefined(layout.getLineMetrics().at(0), 'line')
      expect(layout.getGlyphPositionAtCoordinate(49, indentLine.baseline + 1).pos).toBe(0)
      layout.delete()
    }
  })
})
