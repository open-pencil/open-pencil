import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'
import { pixelLength } from '@open-pencil/scene-graph/text'

import { TextLayout } from '#core/canvas/text/layout'
import { laidOutGlyphs } from '#core/canvas/text/placed'
import { getCanvasKit } from '#core/canvaskit'
import { glyphOutlineSourceSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'

const FAMILY = 'Placed Test Inter'
const FONT_SIZE = 20

/**
 * The family is outlined from InterVariable, as the font manager has it, and drawn by providers
 * holding that file or the static Inter SemiBold file, which numbers most glyphs alike.
 */
let ck: CanvasKit
let staticProvider: TypefaceFontProvider
let variableProvider: TypefaceFontProvider

beforeAll(async () => {
  ck = await getCanvasKit()
  const variable = expectDefined(await fontManager.fetchBundledFont('/InterVariable.ttf'))
  const semibold = expectDefined(await fontManager.fetchBundledFont('/Inter-SemiBold.ttf'))
  await fontManager.markLoaded(FAMILY, 'Regular', variable)
  staticProvider = ck.TypefaceFontProvider.Make()
  staticProvider.registerFont(semibold, FAMILY)
  variableProvider = ck.TypefaceFontProvider.Make()
  variableProvider.registerFont(variable, FAMILY)
})

afterAll(() => {
  staticProvider.delete()
  variableProvider.delete()
})

type PaintFeatures = { name: string; value: number }[]

/**
 * Text in the family, its glyphs drawn from `provider` with `features`, and with `restyled`'s
 * from its index on, as they are saved.
 */
function placed(
  text: string,
  provider: TypefaceFontProvider,
  features: PaintFeatures = [],
  props: Partial<SceneNode> = {},
  restyled?: { from: number; features: PaintFeatures }
) {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    text,
    fontFamily: FAMILY,
    fontSize: FONT_SIZE,
    ...props
  })
  const textStyle = { fontFamilies: [FAMILY], fontSize: FONT_SIZE, fontFeatures: features }
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(
    new ck.ParagraphStyle({ textStyle }),
    provider
  )
  builder.addText(text.slice(0, restyled?.from))
  if (restyled) {
    builder.pushStyle(new ck.TextStyle({ ...textStyle, fontFeatures: restyled.features }))
    builder.addText(text.slice(restyled.from))
    builder.pop()
  }
  const paragraph = builder.build()
  builder.delete()
  try {
    const layout = TextLayout.ofParagraph(ck, paragraph, text.length)
    layout.layout(1000)
    return expectDefined(laidOutGlyphs(node, layout, text, 0), 'laid-out glyphs')
  } finally {
    paragraph.delete()
  }
}

const variableSource = () => expectDefined(glyphOutlineSourceSync(FAMILY, 'Regular'))

describe('the font saved glyphs are outlined from', () => {
  /**
   * The files number `B` and `a` alike but not `t` (#1619): one matching glyph must not let the
   * variable file outline the static file's glyphs, which would save another letter for `t`.
   */
  test('saves the characters in the font it outlines when another file drew them', () => {
    const source = variableSource()
    const glyphs = placed('Bat', staticProvider)

    expect(glyphs.map((glyph) => glyph.id)).toEqual(
      Array.from('Bat', (character) => source.glyphOf(character))
    )
    expect(glyphs.map((glyph) => glyph.firstCharacter)).toEqual([0, 1, 2])
  })

  test('keeps glyphs the font drew for its features and ligatures', () => {
    const source = variableSource()
    // Inter draws the colon between figures and the arrow from glyphs no character maps to.
    for (const text of ['12:30', 'a->b']) {
      const glyphs = placed(text, variableProvider)
      expect(glyphs.map((glyph) => glyph.id)).toEqual(
        source.shape(text, {}).map((glyph) => glyph.id)
      )
      expect(glyphs.some((glyph, index) => glyph.id !== source.glyphOf(text[index]))).toBe(true)
      expect(glyphs.every((glyph) => glyph.source !== null)).toBe(true)
      expect(glyphs.every((glyph) => glyph.source === glyphs[0].source)).toBe(true)
    }
  })

  test('shapes the run itself, placed from its start, when the drawn glyphs are more', () => {
    const source = variableSource()
    // The static file draws `t`, `-` and `>` apart; the font the text asks for joins the arrow.
    const glyphs = placed('t->b', staticProvider, [{ name: 'calt', value: 0 }])

    expect(glyphs.map((glyph) => glyph.id)).toEqual(
      source.shape('t->b', {}).map((glyph) => glyph.id)
    )
    expect(glyphs.map((glyph) => glyph.firstCharacter)).toEqual([0, 1, 3])
    expect(glyphs[0].x).toBe(0)
    for (const [index, glyph] of glyphs.slice(1).entries()) {
      expect(glyph.x).toBeCloseTo(glyphs[index].x + glyphs[index].advance, 3)
    }
  })

  test('confirms a run whose style runs set features of their own', () => {
    const source = variableSource()
    const text = 'a->b a->b'
    // The second arrow keeps its characters: the run drawn from one font has both arrows.
    const glyphs = placed(text, variableProvider, [], {
      styleRuns: [{ start: 5, length: 4, style: { fontFeatures: [{ tag: 'CALT', enabled: false }] } }]
    }, { from: 5, features: [{ name: 'calt', value: 0 }] })

    expect(glyphs.map((glyph) => glyph.firstCharacter)).toEqual([0, 1, 3, 4, 5, 6, 7, 8])
    expect(glyphs.slice(4).map((glyph) => glyph.id)).toEqual(
      Array.from('a->b', (character) => source.glyphOf(character))
    )
    expect(glyphs.every((glyph) => glyph.source !== null)).toBe(true)
  })

  test('spaces reshaped glyphs once per character, by the style of each', () => {
    // The text draws Inter at the optical size of its font size.
    const source = expectDefined(
      glyphOutlineSourceSync(FAMILY, 'Regular', [{ axis: 'opsz', value: FONT_SIZE }])
    )
    // `q` has no precomposed acute, so the mark is a glyph of its own on the same character.
    const text = 't->q\u0301'
    const glyphs = placed(text, staticProvider, [{ name: 'calt', value: 0 }], {
      letterSpacing: pixelLength(10),
      styleRuns: [{ start: 3, length: 2, style: { letterSpacing: pixelLength(4) } }]
    })
    const advances = source.shape(text, {}).map((glyph) => glyph.advance * FONT_SIZE)

    expect(glyphs.map((glyph) => glyph.firstCharacter)).toEqual([0, 1, 3, 3])
    expect(glyphs.map((glyph) => glyph.advance)).toEqual([
      advances[0] + 10,
      advances[1] + 10,
      advances[2],
      advances[3] + 4
    ])
  })

  test('spaces a reshaped ligature once, as the paragraph draws it', () => {
    const text = 'a->b'
    const spacing = 10
    // The width the paragraph draws the arrow ligature at, with `letterSpacing`.
    const drawnArrow = (letterSpacing: number) => {
      const textStyle = { fontFamilies: [FAMILY], fontSize: FONT_SIZE, letterSpacing }
      const builder = ck.ParagraphBuilder.MakeFromFontProvider(
        new ck.ParagraphStyle({ textStyle }),
        variableProvider
      )
      builder.addText(text)
      const paragraph = builder.build()
      builder.delete()
      try {
        paragraph.layout(1000)
        const [run] = paragraph.getShapedLines()[0].runs
        expect(Array.from(run.offsets)).toEqual([0, 1, 3, 4])
        return run.positions[4] - run.positions[2]
      } finally {
        paragraph.delete()
      }
    }
    // The static file draws the arrow's characters apart, so the run is shaped again.
    const reshapedArrow = (letterSpacing: number) =>
      placed(text, staticProvider, [{ name: 'calt', value: 0 }], {
        letterSpacing: pixelLength(letterSpacing)
      })[1]

    expect(reshapedArrow(spacing).firstCharacter).toBe(1)
    expect(reshapedArrow(spacing).id).toBe(variableSource().shape(text, {})[1].id)
    expect(drawnArrow(spacing) - drawnArrow(0)).toBeCloseTo(spacing, 3)
    expect(reshapedArrow(spacing).advance - reshapedArrow(0).advance).toBeCloseTo(spacing, 3)
  })

  test('shapes the run itself with the features the text sets', () => {
    const source = variableSource()
    // With contextual alternates off in the text too, the arrow stays its three characters.
    const glyphs = placed('t->b', staticProvider, [{ name: 'calt', value: 0 }], {
      fontFeatures: [{ tag: 'CALT', enabled: false }]
    })

    expect(glyphs.map((glyph) => glyph.id)).toEqual(
      Array.from('t->b', (character) => source.glyphOf(character))
    )
    expect(glyphs.map((glyph) => glyph.firstCharacter)).toEqual([0, 1, 2, 3])
  })
})
