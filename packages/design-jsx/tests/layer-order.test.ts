import { describe, expect, test } from 'bun:test'

import { selectionToJSX, selectionToJSXWithLayers } from '#design-jsx/index'

import { SceneGraph } from '@open-pencil/scene-graph'

/** Names written on each opening tag, in the order the tags open. */
function openingTagNames(code: string): string[] {
  return [...code.matchAll(/<(?!\/)[A-Za-z]\w*[^>]*?\bname="([^"]*)"/g)].map((match) => match[1])
}

describe('Design JSX layer order', () => {
  test('lists one layer per element in the order elements open, hidden layers included', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const card = graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 100 })
    const title = graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello' })
    const hidden = graph.createNode('RECTANGLE', card.id, { name: 'Hidden', visible: false })
    const row = graph.createNode('FRAME', card.id, { name: 'Row', width: 100, height: 20 })
    const dot = graph.createNode('ELLIPSE', row.id, { name: 'Dot', width: 8, height: 8 })
    const badge = graph.createNode('FRAME', pageId, { name: 'Badge', width: 40, height: 20 })

    const result = selectionToJSXWithLayers([card.id, badge.id], graph)

    // Hidden layers are written with `visible={false}`, so they have elements too.
    expect(result.layerIds).toEqual([card.id, title.id, hidden.id, row.id, dot.id, badge.id])
    expect(openingTagNames(result.code)).toEqual(
      result.layerIds.map((id) => graph.getNode(id)?.name)
    )
    expect(result.code).toBe(selectionToJSX([card.id, badge.id], graph))
  })
})
