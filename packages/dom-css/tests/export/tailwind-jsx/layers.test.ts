import { describe, expect, test } from 'bun:test'

import { sceneNodesToTailwindJSX, sceneNodesToTailwindJSXWithLayers } from '#dom-css/index'

import { makeGraph, pageId } from './helpers'

/** `data-name` of each opening tag, in the order the tags open. */
function openingTagNames(code: string): Array<string | null> {
  return [...code.matchAll(/<(?!\/)[a-z][\w-]*((?:"[^"]*"|[^>"])*)>/g)].map(
    ([, attributes]) => /data-name="([^"]*)"/.exec(attributes)?.[1] ?? null
  )
}

describe('Tailwind JSX layer order', () => {
  test('lists the layer behind each element in the order elements open', () => {
    const graph = makeGraph()
    const card = graph.createNode('FRAME', pageId(graph), { name: 'Card', width: 200, height: 100 })
    const title = graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello' })
    const swatch = graph.createNode('RECTANGLE', card.id, { name: 'Swatch', width: 20, height: 20 })
    const badge = graph.createNode('FRAME', pageId(graph), { name: 'Badge', width: 40, height: 20 })

    const result = sceneNodesToTailwindJSXWithLayers(graph, [card.id, badge.id])

    expect(result.layerIds).toEqual([card.id, title.id, swatch.id, badge.id])
    expect(openingTagNames(result.code)).toEqual(['Card', 'Title', 'Swatch', 'Badge'])
    expect(result.code).toBe(sceneNodesToTailwindJSX(graph, [card.id, badge.id]))
  })
})
