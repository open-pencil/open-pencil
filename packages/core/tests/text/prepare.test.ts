import { afterEach, beforeAll, describe, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { SceneGraph } from '@open-pencil/scene-graph'

import { NOTO_COLOR_EMOJI_FAMILY } from '#core/text/emoji'
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
