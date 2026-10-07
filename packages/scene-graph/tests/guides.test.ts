import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { guideOwnersOnPage } from '@open-pencil/scene-graph/guides'

const guide = (id: string) => ({ id, axis: 'x' as const, position: 10 })
const names = (graph: SceneGraph, pageId: string) =>
  guideOwnersOnPage(graph, pageId).map((node) => node.name).toSorted()

describe('guide owners', () => {
  test('lists the page and frames at any depth that carry guides, on that page only', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    graph.updateNode(page.id, { guides: [guide('page')] })
    const top = graph.createNode('FRAME', page.id, { name: 'Top' })
    graph.createNode('FRAME', top.id, { name: 'Nested', guides: [guide('nested')] })
    graph.createNode('FRAME', page.id, { name: 'Plain' })
    const other = graph.addPage('Other')
    graph.createNode('FRAME', other.id, { name: 'Elsewhere', guides: [guide('elsewhere')] })

    expect(names(graph, page.id)).toEqual(['Nested', page.name].toSorted())
    expect(names(graph, other.id)).toEqual(['Elsewhere'])
  })

  test('follows guides added, removed, created, deleted, and moved after the first read', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Frame' })
    expect(names(graph, page.id)).toEqual([])

    graph.updateNode(frame.id, { guides: [guide('a')] })
    expect(names(graph, page.id)).toEqual(['Frame'])
    const late = graph.createNode('FRAME', page.id, { name: 'Late', guides: [guide('b')] })
    expect(names(graph, page.id)).toEqual(['Frame', 'Late'])

    graph.updateNode(frame.id, { guides: [] })
    graph.deleteNode(late.id)
    expect(names(graph, page.id)).toEqual([])

    const moved = graph.createNode('FRAME', page.id, { name: 'Moved', guides: [guide('c')] })
    const other = graph.addPage('Other')
    graph.reparentNode(moved.id, other.id)
    expect(names(graph, page.id)).toEqual([])
    expect(names(graph, other.id)).toEqual(['Moved'])
  })
})
