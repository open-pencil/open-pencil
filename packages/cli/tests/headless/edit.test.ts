import { expect, test } from 'bun:test'
import { join } from 'node:path'

import { FIXTURES } from '#cli-tests/helpers/paths'

import { getTextMeasurer } from '@open-pencil/core/layout'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

import { editDocument, measureTextHeadlessly } from '#cli/headless'

test('sizes the text an edit writes in the fonts its characters load after it', async () => {
  // A family nothing loaded yet, as a script's new characters need a web font fetched again.
  const family = 'Edit Test Han'
  const font = await Bun.file(join(FIXTURES, 'fonts', 'NotoSansSC-Regular.ttf')).arrayBuffer()
  fontManager.setHostFontLoader(async (name) => (name === family ? font : null))
  try {
    await measureTextHeadlessly()
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const id = await editDocument(
      graph,
      () =>
        graph.createNode('TEXT', pageId, {
          text: '中文字',
          fontFamily: family,
          fontSize: 40,
          textAutoResize: 'WIDTH_AND_HEIGHT'
        }).id
    )
    const node = graph.getNode(id)
    if (!node) throw new Error('Expected the text')
    const measured = getTextMeasurer()?.(node)
    if (!measured) throw new Error('Expected the text measured in its font')
    // Each Han character is one em wide in the font, so three at 40 px are 120 px; a stand-in
    // measures them otherwise.
    expect(node.width).toBe(120)
    expect(node.width).toBe(measured.width)
    expect(node.height).toBe(measured.height)
  } finally {
    fontManager.setHostFontLoader(null)
  }
})
