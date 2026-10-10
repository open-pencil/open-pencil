import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import type { ShapedText, ShapedTextGlyph } from '@open-pencil/fig/node-change'
import { SceneGraph, type SceneNode, type TextParagraphStyle } from '@open-pencil/scene-graph'

import { buildParagraph } from '#core/canvas/text/layout/build'
import { withFigExportRuntime } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/fonts'
import { glyphAdvanceSync } from '#core/text/opentype'

const ul = (indentation = 1): TextParagraphStyle => ({ listType: 'UNORDERED', indentation })
const ol = (indentation = 1): TextParagraphStyle => ({ listType: 'ORDERED', indentation })
const plain: TextParagraphStyle = { listType: 'NONE', indentation: 0 }

async function shape(props: Partial<SceneNode>): Promise<ShapedText> {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 16,
    width: 400,
    height: 400,
    textAutoResize: 'HEIGHT',
    ...props
  })
  const shaped = await withFigExportRuntime(graph, await getCanvasKit(), async (runtime) =>
    runtime.shapeText(node)
  )
  return expectDefined(shaped, 'shaped text')
}

/** Marker glyphs by line, from their baselines: they draw no character of the text. */
function markersOn(shaped: ShapedText, line: number): ShapedTextGlyph[] {
  const y = shaped.baselines[line].position.y
  return shaped.glyphs.filter((glyph) => glyph.firstCharacter === undefined && glyph.y === y)
}

function lineStarts(shaped: ShapedText): number[] {
  return shaped.baselines.map((baseline) => baseline.position.x)
}

// The layout rules below were measured in live Figma (2026-10-09) from the glyphs it saves.
describe('text lists', () => {
  beforeAll(async () => {
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
      'bundled Inter font'
    )
    fontManager.markLoaded('Inter', 'Regular', inter)
  })

  test('indents items one and a half ems per level and centres bullets in the indent', async () => {
    const shaped = await shape({
      text: 'Intro\nOne\nTwo\nNested',
      textParagraphs: [plain, ul(), ul(), ul(2)]
    })
    expect(lineStarts(shaped)).toEqual([0, 24, 24, 48])
    expect(markersOn(shaped, 0)).toEqual([])
    for (const [line, centre] of [
      [1, 12],
      [3, 36]
    ] as const) {
      const [bullet] = markersOn(shaped, line)
      expect(bullet.x + bullet.advance / 2).toBeCloseTo(centre, 2)
      expect(bullet.commands?.length).toBeGreaterThan(0)
    }
  })

  test('ends numbers a third of an em before the text and widens them past nine', async () => {
    const short = await shape({ text: 'a\nb', textParagraphs: [ol(), ol()] })
    const [number, period] = markersOn(short, 0)
    expect(short.baselines[0].position.x).toBe(24)
    expect(period.x + period.advance).toBeCloseTo(24 - 16 / 3, 2)
    expect(number.x).toBeLessThan(period.x)

    const long = await shape({
      text: Array.from({ length: 12 }, (_, index) => `item${index + 1}`).join('\n'),
      textParagraphs: Array.from({ length: 12 }, () => ol())
    })
    const digit = expectDefined(glyphAdvanceSync('Inter', 'Regular', 48, 16), 'glyph 48')
    const start = 24 + digit
    expect(new Set(lineStarts(long))).toEqual(new Set([start]))
    const ten = markersOn(long, 9)
    expect(ten).toHaveLength(3)
    const last = expectDefined(ten.at(-1), 'period')
    expect(last.x + last.advance).toBeCloseTo(start - 16 / 3, 2)
  })

  test('hangs wrapped lines of an item at its indent and marks only its first line', async () => {
    const shaped = await shape({
      text: 'a list item that wraps over several lines\nshort',
      width: 120,
      textParagraphs: [ul(), ul()]
    })
    expect(shaped.baselines.length).toBeGreaterThan(2)
    for (const start of lineStarts(shaped)) expect(start).toBe(24)
    expect(markersOn(shaped, 0)).toHaveLength(1)
    expect(markersOn(shaped, 1)).toHaveLength(0)
  })

  test('spaces list items by list spacing and other paragraphs by paragraph spacing', async () => {
    const base = await shape({ text: 'p1\np2\nl1\nl2\np3', textParagraphs: [plain, plain, ul(), ul()] })
    const spaced = await shape({
      text: 'p1\np2\nl1\nl2\np3',
      textParagraphs: [plain, plain, ul(), ul()],
      listSpacing: 10,
      paragraphSpacing: 7
    })
    const gaps = (shaped: ShapedText) =>
      shaped.baselines.slice(1).map((line, index) => line.position.y - shaped.baselines[index].position.y)
    expect(gaps(spaced).map((gap, index) => gap - gaps(base)[index])).toEqual([7, 7, 10, 7])
  })

  test('indents the first line of plain paragraphs, not list items', async () => {
    const shaped = await shape({
      text: 'first paragraph wraps here\nsecond\nitem',
      width: 140,
      paragraphIndent: 20,
      textParagraphs: [plain, plain, ul()]
    })
    const starts = lineStarts(shaped)
    expect(starts[0]).toBe(20)
    expect(starts[1]).toBe(0)
    expect(starts.at(-2)).toBe(20)
    expect(starts.at(-1)).toBe(24)
  })

  test('spaces each paragraph by its own spacing, falling back to the text\'s', async () => {
    const text = 'P1\nP2\nI1\nI2\nP3\nP4'
    const gaps = (shaped: ShapedText) =>
      shaped.baselines.slice(1).map((line, index) => {
        return line.position.y - shaped.baselines[index].position.y
      })
    const flat = gaps(await shape({ text }))
    const spaced = gaps(
      await shape({
        text,
        paragraphSpacing: 10,
        listSpacing: 4,
        textParagraphs: [
          plain,
          { ...plain, paragraphSpacing: 25 },
          ol(),
          { ...ol(), paragraphSpacing: 40 },
          { ...plain, listSpacing: 33 }
        ]
      })
    )
    // Live Figma (2026-10-10): the space after a paragraph is its own; list spacing applies
    // only between two items, and a plain paragraph's list spacing does nothing.
    expect(spaced.map((gap, index) => gap - flat[index])).toEqual([10, 25, 4, 40, 10])
  })

  test('indents the first line of each paragraph by its own indent', async () => {
    const shaped = await shape({
      text: 'A\nB\nC',
      paragraphIndent: 8,
      textParagraphs: [plain, { ...plain, paragraphIndent: 30 }]
    })
    expect(lineStarts(shaped)).toEqual([8, 30, 8])
  })

  test('hangs markers outside the box for a hanging list', async () => {
    const shaped = await shape({ text: 'A\nB', textParagraphs: [ul(), ul()], hangingList: true })
    expect(lineStarts(shaped)).toEqual([0, 0])
    const [bullet] = markersOn(shaped, 0)
    expect(bullet.x + bullet.advance / 2).toBeCloseTo(-12, 2)
  })

  test('gives a truncated item back its lines when a wider layout has room', async () => {
    const ck = await getCanvasKit()
    const fontProvider = ck.TypefaceFontProvider.Make()
    fontManager.attachProvider(ck, fontProvider)
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      fontFamily: 'Inter',
      fontSize: 16,
      text: `Alpha beta\n${'word '.repeat(60).trim()}`,
      textParagraphs: [ul(), ul()],
      textTruncation: 'ENDING',
      maxLines: 4
    })
    const layout = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node)
    try {
      layout.layout(200)
      const wide = layout.getLineMetrics().length
      layout.layout(60)
      layout.layout(200)
      expect(wide).toBe(4)
      expect(layout.getLineMetrics()).toHaveLength(wide)
    } finally {
      layout.delete()
      fontManager.detachProvider(fontProvider)
      fontProvider.delete()
    }
  })
})
