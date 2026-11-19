import { describe, expect, test } from 'bun:test'

import { sceneNodeToJSX, selectionToJSXWithLayers } from '#design-jsx/index'

import { makeGraph, pageId } from './helpers'

function cardGraph() {
  const graph = makeGraph()
  const card = graph.createNode('FRAME', pageId(graph), { name: 'Card', width: 200, height: 100 })
  const title = graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello' })
  const row = graph.createNode('FRAME', card.id, { name: 'Row', width: 100, height: 20 })
  const dot = graph.createNode('ELLIPSE', row.id, { name: 'Dot', width: 8, height: 8 })
  graph.createNode('ELLIPSE', row.id, { name: 'Ring', width: 8, height: 8 })
  return { graph, card, title, row, dot }
}

describe('Design JSX export depth', () => {
  test('writes every level without a depth', () => {
    const { graph, card } = cardGraph()
    const code = sceneNodeToJSX(card.id, graph)
    expect(code).toContain('name="Dot"')
    expect(code).not.toContain('keepChildren')
  })

  test('writes layers at the depth with keepChildren and what they hold', () => {
    const { graph, card, row } = cardGraph()
    const code = sceneNodeToJSX(card.id, graph, { maxDepth: 1 })
    expect(code).toContain('name="Title"')
    expect(code).toContain(`keepChildren>\n    {/* 2 layers kept, id ${row.id} */}\n  </Frame>`)
    expect(code).not.toContain('name="Dot"')
  })

  test('keeps a root’s children at depth 0', () => {
    const { graph, card } = cardGraph()
    expect(sceneNodeToJSX(card.id, graph, { maxDepth: 0 })).toBe(
      sceneNodeToJSX(card.id, graph).split('>')[0] +
        ` keepChildren>\n  {/* 4 layers kept, id ${card.id} */}\n</Frame>`
    )
  })

  test('lists only the layers it writes', () => {
    const { graph, card, title, row } = cardGraph()
    const { layerIds } = selectionToJSXWithLayers([card.id], graph, { maxDepth: 1 })
    expect(layerIds).toEqual([card.id, title.id, row.id])
  })

  test('counts depth from each root of a selection', () => {
    const { graph, card, row } = cardGraph()
    const badge = graph.createNode('FRAME', pageId(graph), { name: 'Badge', width: 40, height: 20 })
    graph.createNode('TEXT', badge.id, { name: 'Label', text: 'New' })
    const { code } = selectionToJSXWithLayers([card.id, badge.id], graph, { maxDepth: 1 })
    expect(code).toContain(`id ${row.id}`)
    expect(code).toContain('name="Label"')
  })

  test('writes in full what rendering would rebuild, as an instance written as a frame', () => {
    const graph = makeGraph()
    const board = graph.createNode('FRAME', pageId(graph), { name: 'Board', width: 200 })
    // An instance whose component is gone is written as a frame, which rebuilds it on render.
    const instance = graph.createNode('INSTANCE', board.id, { name: 'Copy', width: 100 })
    const inner = graph.createNode('FRAME', instance.id, { name: 'Inner', width: 50 })
    graph.createNode('RECTANGLE', inner.id, { name: 'Dot', width: 8 })

    const code = sceneNodeToJSX(board.id, graph, { maxDepth: 1 })

    expect(code).toContain('name="Dot"')
    expect(code).not.toContain('keepChildren')
  })
})
