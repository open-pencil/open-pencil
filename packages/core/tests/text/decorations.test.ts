import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'
import { toUint8Array } from 'js-base64'
import * as v from 'valibot'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { savedDecoratedGlyphs, textDecorationRects } from '#core/text/decorations'

const rectSchema = v.object({ x: v.number(), y: v.number(), w: v.number(), h: v.number() })
const oracleSchema = v.object({
  outlines: v.array(v.string()),
  cases: v.array(
    v.object({
      name: v.string(),
      text: v.string(),
      fontSize: v.number(),
      textDecoration: v.picklist(['NONE', 'UNDERLINE', 'STRIKETHROUGH']),
      textDecorationStyle: v.picklist(['SOLID', 'DOTTED', 'WAVY']),
      styleRuns: v.array(
        v.object({
          start: v.number(),
          length: v.number(),
          style: v.record(v.string(), v.unknown())
        })
      ),
      glyphs: v.array(
        v.object({
          outline: v.number(),
          x: v.number(),
          y: v.number(),
          fontSize: v.number(),
          firstCharacter: v.optional(v.number()),
          advance: v.optional(v.number())
        })
      ),
      figmaRects: v.array(rectSchema)
    })
  )
})

const oracle = v.parse(
  v.pipe(v.string(), v.parseJson(), oracleSchema),
  await Bun.file(join(FIXTURES, 'figma-oracles/text-decorations.json')).text()
)

function oracleCase(name: string) {
  const found = expectDefined(
    oracle.cases.find((item) => item.name === name),
    name
  )
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: found.text,
    // Not a loaded font, so the metrics are Figma's Inter, as for any text drawn from saved
    // glyphs without its font.
    fontFamily: '__FigmaInter__',
    fontSize: found.fontSize,
    textDecoration: found.textDecoration,
    textDecorationStyle: found.textDecorationStyle,
    styleRuns: found.styleRuns as SceneNode['styleRuns']
  })
  const glyphs = found.glyphs.map(({ outline, ...glyph }) => ({
    ...glyph,
    commandsBlob: toUint8Array(expectDefined(oracle.outlines[outline], 'outline'))
  }))
  return { node, glyphs, figmaRects: found.figmaRects }
}

function byPosition<T extends Vector>(rects: T[]): T[] {
  return rects.toSorted((a, b) => a.y - b.y || a.x - b.x)
}

/** Checks rects against Figma's to within `tolerance` pixels. */
function expectFigmaRects(name: string, tolerance: number) {
  const { node, glyphs, figmaRects } = oracleCase(name)
  const ours = byPosition(textDecorationRects(node, savedDecoratedGlyphs(glyphs)))
  const figma = byPosition(figmaRects)
  expect(ours).toHaveLength(figma.length)
  for (const [index, rect] of ours.entries()) {
    const expected = figma[index]
    expect(Math.abs(rect.x - expected.x)).toBeLessThan(tolerance)
    expect(Math.abs(rect.x + rect.width - (expected.x + expected.w))).toBeLessThan(tolerance)
    expect(Math.abs(rect.y - expected.y)).toBeLessThan(0.002)
    expect(Math.abs(rect.height - expected.h)).toBeLessThan(0.002)
  }
}

// Figma's own glyphs and the decoration rects it saved with them (2026-10-11).
describe('text decorations as Figma saves them', () => {
  test('place underlines, strikethroughs, offsets, and thicknesses from the font', () => {
    expectFigmaRects('deco-decorations', 0.02)
  })

  test('break underlines around descenders, widened by the thickness', () => {
    expectFigmaRects('skip-Inter-24', 0.02)
    expectFigmaRects('skip-Inter-96', 0.08)
  })

  test('break dotted and wavy underlines by less, keeping narrow pieces', () => {
    expectFigmaRects('skip-WAVY-24', 0.02)
    expectFigmaRects('skip-DOTTED-24', 0.02)
  })

  test('keep underlines whole when skip ink is off', () => {
    const { node, glyphs } = oracleCase('skip-Inter-24')
    node.textDecorationSkipInk = false
    const rects = textDecorationRects(node, savedDecoratedGlyphs(glyphs))
    expect(rects).toHaveLength(1)
    expect(rects[0].x).toBe(0)
  })
})
