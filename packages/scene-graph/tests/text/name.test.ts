import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { createSticky, generatedFrameText } from '@open-pencil/scene-graph/generated'
import { renameChanges, textLayerName } from '@open-pencil/scene-graph/text'

function page(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('text layer names', () => {
  test('put the text on one line, as Figma names a layer', () => {
    expect(textLayerName('Line one\nLine two')).toBe('Line one Line two')
    expect(textLayerName('  padded  text  ')).toBe('padded text')
    expect(textLayerName('x'.repeat(300))).toHaveLength(300)
    expect(textLayerName(' \n ')).toBe('Text')
  })

  test('a text layer made with text is named by it, and one made with another name is named', () => {
    const graph = new SceneGraph()
    expect(graph.createNode('TEXT', page(graph), { text: 'Hello world' }).name).toBe('Hello world')
    const named = graph.createNode('TEXT', page(graph), { text: 'Hi', name: 'Title' })
    expect([named.name, named.autoRename]).toEqual(['Title', false])
    const same = graph.createNode('TEXT', page(graph), { text: 'Hi', name: 'Hi' })
    expect(same.autoRename).toBe(true)
    const flagged = graph.createNode('TEXT', page(graph), {
      text: 'Hi',
      name: 'T',
      autoRename: true
    })
    expect([flagged.name, flagged.autoRename]).toEqual(['T', true])
    expect(graph.createNode('TEXT', page(graph)).name).toBe('Text')
    expect(graph.createNode('FRAME', page(graph), { text: 'Hi' }).name).toBe('Frame')
  })

  test('the name follows the text it is given, in edits and previews', () => {
    const graph = new SceneGraph()
    const { id } = graph.createNode('TEXT', page(graph))
    graph.updateNode(id, { text: 'Hello' })
    expect(graph.getNode(id)?.name).toBe('Hello')
    graph.runPreviewUpdates(() => graph.updateNode(id, { text: 'Hello there' }))
    expect(graph.getNode(id)?.name).toBe('Hello there')
    graph.updateNode(id, { text: '' })
    expect(graph.getNode(id)?.name).toBe('Text')
  })

  test('a name written with the text wins, and a renamed layer keeps its name', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', page(graph), { text: 'Hello' })
    graph.updateNode(node.id, { text: 'Bye', name: 'Greeting' })
    expect(node.name).toBe('Greeting')

    graph.updateNode(node.id, renameChanges(node, 'Title'))
    graph.updateNode(node.id, { text: 'Changed' })
    expect([node.name, node.autoRename]).toEqual(['Title', false])

    graph.updateNode(node.id, { autoRename: true })
    expect(node.name).toBe('Changed')
  })

  test('renaming other layers writes only the name', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', page(graph))
    expect(renameChanges(frame, 'Card')).toEqual({ name: 'Card' })
  })

  test('a document loading keeps the names it has', () => {
    const graph = new SceneGraph()
    const node = graph.applyImportedStateDuring(() =>
      graph.createNode('TEXT', page(graph), { text: 'Hello' })
    )
    graph.applyImportedStateDuring(() => graph.updateNode(node.id, { text: 'Bye' }))
    expect(node.name).toBe('Text')
  })

  test("a generated frame's text keeps its template name", () => {
    const graph = new SceneGraph()
    const sticky = createSticky(graph, page(graph), { text: 'Hi' })
    const body = generatedFrameText(graph, sticky)
    if (!body) throw new Error('sticky without a body')
    const before = body.name
    graph.updateNode(body.id, { text: 'Changed' })
    expect(body.name).toBe(before)
  })
})
