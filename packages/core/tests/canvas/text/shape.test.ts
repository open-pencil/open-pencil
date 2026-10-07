import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { withFigExportRuntime } from '#core/canvas/text/shape'
import { getCanvasKit } from '#core/canvaskit'
import { fontManager } from '#core/text/fonts'
import { getGlyphOutlineMetricsSync } from '#core/text/opentype'

import type { ShapedText } from '@open-pencil/fig/node-change'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

const SENTENCE = 'A sentence long enough that it has to wrap onto a second line.'

async function shape(props: Partial<SceneNode>): Promise<ShapedText | null> {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 16,
    width: 230,
    height: 32,
    textAutoResize: 'HEIGHT',
    ...props
  })
  return withFigExportRuntime(graph, await getCanvasKit(), async (runtime) =>
    runtime.shapeText(node)
  )
}

describe('text shaping for saved glyphs', () => {
  beforeAll(async () => {
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/Inter-Regular.ttf'),
      'bundled Inter font'
    )
    fontManager.markLoaded('Inter', 'Regular', inter)
  })

  test('breaks lines at the layer width (#914)', async () => {
    const shaped = expectDefined(await shape({ text: SENTENCE }), 'shaped text')
    const [first, second] = shaped.baselines

    expect(shaped.baselines).toHaveLength(2)
    expect(second.firstCharacter).toBe(first.endCharacter)
    expect(second.position.y - first.position.y).toBe(16)
    for (const glyph of shaped.glyphs) {
      expect(glyph.x + glyph.advance).toBeLessThanOrEqual(230.5)
      expect([first.position.y, second.position.y]).toContain(glyph.y)
    }
    expect(shaped.logicalIndexToCharacterOffsetMap).toHaveLength(SENTENCE.length)
    expect(shaped.logicalIndexToCharacterOffsetMap[second.firstCharacter]).toBe(0)
  })

  test('places lines by horizontal and vertical alignment', async () => {
    const top = expectDefined(await shape({ text: 'Centered', height: 64 }), 'top')
    const centered = expectDefined(
      await shape({
        text: 'Centered',
        height: 64,
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'CENTER'
      }),
      'centered'
    )
    const line = centered.baselines[0]

    expect(line.position.x).toBeCloseTo((230 - line.width) / 2, 1)
    expect(centered.glyphs[0].x).toBeCloseTo(line.position.x, 3)
    expect(line.position.y - top.baselines[0].position.y).toBe(24)
  })

  test('draws each glyph the shaper chose, such as a contextual arrow', async () => {
    const shaped = expectDefined(await shape({ text: 'a->b' }), 'shaped text')
    const arrow = expectDefined(
      shaped.glyphs.find((glyph) => glyph.firstCharacter === 1),
      'arrow glyph'
    )
    const hyphen = expectDefined(getGlyphOutlineMetricsSync('Inter', 'Regular', '-', 13)?.[0])

    expect(shaped.glyphs).toHaveLength(3)
    expect(arrow.commands).not.toEqual(hyphen.commands)
    expect(shaped.logicalIndexToCharacterOffsetMap[2]).toBe(arrow.x)
  })

  test('keeps the layout but no outlines when the font is not loaded', async () => {
    const shaped = expectDefined(
      await shape({ text: SENTENCE, fontFamily: 'Missing Font' }),
      'shaped text'
    )

    expect(shaped.baselines.length).toBeGreaterThan(1)
    expect(shaped.glyphs.every((glyph) => glyph.commands === null)).toBe(true)
  })

  test('keeps the layout but no outlines for decorations across lines', async () => {
    const shaped = expectDefined(
      await shape({ text: SENTENCE, textDecoration: 'UNDERLINE' }),
      'shaped text'
    )

    expect(shaped.baselines).toHaveLength(2)
    expect(shaped.glyphs.every((glyph) => glyph.commands === null)).toBe(true)
  })

  test('does not shape truncated text', async () => {
    expect(await shape({ text: SENTENCE, textTruncation: 'ENDING' })).toBeNull()
  })
})
