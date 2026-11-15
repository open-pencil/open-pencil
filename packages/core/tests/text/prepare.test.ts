import { afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { getCanvasKit } from '#core/canvaskit'
import { withFigExportRuntime } from '#core/io/formats/fig/export/runtime'
import { NOTO_COLOR_EMOJI_FAMILY } from '#core/text/emoji'
import { glyphOutlineSourceSync, shapedAdvancesSync } from '#core/text/font/glyphs'
import { fontManager } from '#core/text/font/manager'
import { prepareGraphFonts } from '#core/text/prepare'

function graphWithText(text: string) {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, { text, fontFamily: 'Inter' })
  return { graph, nodeIds: [node.id] }
}

/**
 * Where nothing draws platform emoji, Noto Color Emoji is fetched for the emoji a text's layout
 * leaves to the emoji metrics font, and only those: a symbol the text font has stays text and
 * must not cost the whole emoji font's download.
 */
describe('emoji font preparation', () => {
  const requested: string[] = []
  let spy: ReturnType<typeof spyOn> | null = null

  beforeAll(async () => {
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/InterVariable.ttf'),
      'bundled Inter font'
    )
    await fontManager.markLoaded('Inter', 'Regular', inter)
  })

  afterEach(() => {
    spy?.mockRestore()
    requested.length = 0
  })

  function recordNotoRequests() {
    const load = fontManager.loadRemoteFont.bind(fontManager)
    spy = spyOn(fontManager, 'loadRemoteFont').mockImplementation(
      async (family, style, characters) => {
        if (family === NOTO_COLOR_EMOJI_FAMILY) {
          requested.push(characters ?? '')
          return null
        }
        return load(family, style, characters)
      }
    )
  }

  test('fetches nothing for symbols the text font has', async () => {
    recordNotoRequests()
    const { graph, nodeIds } = graphWithText('© ™ ↔ text')
    await prepareGraphFonts(graph, nodeIds)
    expect(requested).toEqual([])
  })

  test('fetches the emoji the text font lacks', async () => {
    recordNotoRequests()
    const { graph, nodeIds } = graphWithText('© 😀')
    await prepareGraphFonts(graph, nodeIds)
    expect(requested).toEqual(['😀'])
  })
})

describe('fallback faces of a family found nowhere', () => {
  beforeAll(async () => {
    const inter = expectDefined(
      await fontManager.fetchBundledFont('/InterVariable.ttf'),
      'bundled Inter font'
    )
    await fontManager.markLoaded('Inter', 'Regular', inter)
  })

  /**
   * Without the default family's italic, CanvasKit slants its upright face and the saved outlines
   * stay upright; with it, both are the real italic, as for text set in that family.
   */
  test('draws and saves an italic in the default family’s italic', async () => {
    const family = 'Prepare Missing Italic'
    const load = fontManager.loadRemoteFont.bind(fontManager)
    const spy = spyOn(fontManager, 'loadRemoteFont').mockImplementation(
      async (requested, style, characters) =>
        requested === family ? null : load(requested, style, characters)
    )
    try {
      const text = 'lag'
      const graph = new SceneGraph()
      const node = graph.createNode('TEXT', graph.getPages()[0].id, {
        text,
        fontFamily: family,
        italic: true,
        fontSize: 13,
        width: 200,
        height: 20,
        textAutoResize: 'NONE'
      })
      await prepareGraphFonts(graph, [node.id])
      expect(fontManager.isStyleLoaded(family, 'Italic')).toBe(false)

      const italic = expectDefined(glyphOutlineSourceSync('Inter', 'Regular Italic'))
      const advances = expectDefined(shapedAdvancesSync('Inter', 'Regular Italic', text, 13))
      const shaped = expectDefined(
        await withFigExportRuntime(graph, await getCanvasKit(), async (runtime) =>
          runtime.shapeText(node)
        )
      )
      expect(shaped.glyphs).toHaveLength(text.length)
      for (const [position, glyph] of shaped.glyphs.entries()) {
        const index = expectDefined(glyph.firstCharacter)
        expect(glyph.advance).toBeCloseTo(advances[position].advance, 2)
        expect(glyph.commands).toEqual(italic.outline(italic.glyphOf(text[index]), 13))
      }
    } finally {
      spy.mockRestore()
    }
  })
})
