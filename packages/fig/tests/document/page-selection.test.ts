import { expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { guid } from '#fig-tests/helpers/guid'

import { createFigDocumentSession, materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

test('selected-page assembly excludes unrelated content but keeps cross-page components', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'CANVAS', name: 'Design' },
    { guid: guid(2), type: 'CANVAS', name: 'Library' },
    {
      guid: guid(3),
      type: 'SYMBOL',
      parentIndex: { guid: guid(2), position: '!' }
    },
    {
      guid: guid(4),
      type: 'TEXT',
      parentIndex: { guid: guid(3), position: '!' },
      textData: { characters: 'Shared' }
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      symbolData: { symbolID: guid(3) }
    },
    {
      guid: guid(6),
      type: 'TEXT',
      parentIndex: { guid: guid(2), position: '"' },
      textData: { characters: 'Unrelated' }
    }
  ]
  const selected = materializeDocument(changes, [], {
    pageIds: new Set(['1:1'])
  })
  const full = materializeDocument(changes)
  expect(selected.graph.getPages()).toHaveLength(2)
  expect(selected.sources.has('1:6')).toBe(false)
  expect(full.sources.has('1:6')).toBe(true)
  const id = selected.sources.get('1:5')
  if (!id) throw new Error('Missing selected instance')
  expect(selected.graph.getChildren(id)[0].text).toBe('Shared')
  expect(() => materializeDocument(changes, [], { pageIds: new Set(['missing']) })).toThrow(
    'Unknown page'
  )
})

/**
 * Page 1:2 places the inner component, which Outer encloses beside other layers on page 1:3.
 * `placed` adds an instance of Outer to page 1:3; `extra` adds records.
 */
async function enclosedComponentArchive(
  placed = true,
  extra: NodeChange[] = []
): Promise<ArrayBuffer> {
  const records: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    {
      guid: guid(2),
      type: 'CANVAS',
      parentIndex: { guid: guid(1), position: '!' }
    },
    {
      guid: guid(10),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: '!' },
      symbolData: { symbolID: guid(5) }
    },
    {
      guid: guid(3),
      type: 'CANVAS',
      parentIndex: { guid: guid(1), position: '"' }
    },
    {
      guid: guid(4),
      type: 'SYMBOL',
      name: 'Outer',
      parentIndex: { guid: guid(3), position: '!' }
    },
    {
      guid: guid(5),
      type: 'SYMBOL',
      name: 'Inner',
      parentIndex: { guid: guid(4), position: '!' }
    },
    {
      guid: guid(6),
      type: 'TEXT',
      parentIndex: { guid: guid(5), position: '!' },
      textData: { characters: 'Inner' }
    },
    {
      guid: guid(7),
      type: 'TEXT',
      parentIndex: { guid: guid(4), position: '"' },
      textData: { characters: 'Beside' }
    },
    {
      guid: guid(8),
      type: 'INSTANCE',
      parentIndex: { guid: guid(4), position: '#' },
      symbolData: { symbolID: guid(11) }
    },
    {
      guid: guid(11),
      type: 'SYMBOL',
      name: 'Label',
      parentIndex: { guid: guid(3), position: '"' }
    },
    {
      guid: guid(12),
      type: 'TEXT',
      parentIndex: { guid: guid(11), position: '!' },
      textData: { characters: 'Label' }
    },
    {
      guid: guid(9),
      type: 'INSTANCE',
      parentIndex: { guid: guid(3), position: '#' },
      symbolData: { symbolID: guid(4) }
    }
  ]
  if (!placed) records.pop()
  records.push(...extra)
  return figArchiveOf(records)
}

function layers(graph: SceneGraph, id: string): unknown {
  const node = graph.getNode(id)
  if (!node) throw new Error(`Missing layer ${id}`)
  return [node.type, node.text, graph.getChildren(id).map((child) => layers(graph, child.id))]
}

test.each([false, true])(
  'builds a component enclosing a component placed on another page once its own page loads (resumed: %p)',
  async (resumed) => {
    const bytes = await enclosedComponentArchive()
    const expected = createFigDocumentSession(bytes)
    expected.loadPage('1:3')
    let session = createFigDocumentSession(bytes)
    session.loadPage('1:2')
    if (resumed) {
      session = createFigDocumentSession(
        bytes,
        {},
        { graph: session.graph, checkpoint: session.checkpoint() }
      )
    }
    session.loadPage('1:3')
    for (const id of ['1:4', '1:9']) {
      const loaded = new Map(session.checkpoint().sources).get(id)
      const reference = new Map(expected.checkpoint().sources).get(id)
      if (!loaded || !reference) throw new Error(`Missing ${id}`)
      expect(layers(session.graph, loaded)).toEqual(layers(expected.graph, reference))
    }
    const components = (graph: SceneGraph) =>
      [...graph.getAllNodes()].filter((node) => node.type === 'COMPONENT').length
    expect(components(session.graph)).toBe(components(expected.graph))
  }
)

test.each([false, true])(
  'keeps a layer deleted from the enclosed component deleted when the enclosing page loads (resumed: %p)',
  async (resumed) => {
    const bytes = await enclosedComponentArchive(false)
    let session = createFigDocumentSession(bytes)
    session.loadPage('1:2')
    const { graph } = session
    const inner = new Map(session.checkpoint().componentIds).get('1:5')
    if (!inner) throw new Error('Missing inner component')
    graph.deleteNode(graph.getChildren(inner)[0].id)
    if (resumed) {
      session = createFigDocumentSession(bytes, {}, { graph, checkpoint: session.checkpoint() })
    }
    session.loadPage('1:3')
    const outer = new Map(session.checkpoint().componentIds).get('1:4')
    if (!outer) throw new Error('Missing outer component')
    expect(layers(graph, outer)).toEqual([
      'COMPONENT',
      '',
      [
        ['COMPONENT', '', []],
        ['TEXT', 'Beside', []],
        ['INSTANCE', '', [['TEXT', 'Label', []]]]
      ]
    ])
    expect(session.checkpoint().components.map(([id]) => id)).toContain('1:4')
  }
)

test('checkpoints a resumed session after a component layer is deleted', async () => {
  const bytes = await enclosedComponentArchive(false)
  const initial = createFigDocumentSession(bytes)
  initial.loadPage('1:2')
  const { graph } = initial
  const resumed = createFigDocumentSession(bytes, {}, { graph, checkpoint: initial.checkpoint() })
  const inner = new Map(resumed.checkpoint().componentIds).get('1:5')
  if (!inner) throw new Error('Missing inner component')
  const deleted = graph.getChildren(inner)[0].id
  graph.deleteNode(deleted)
  const again = createFigDocumentSession(bytes, {}, { graph, checkpoint: resumed.checkpoint() })
  const component = new Map(again.checkpoint().components).get('1:5')
  expect(component?.nodes.map(({ nodeId }) => nodeId)).toEqual([inner])
})

test.each([false, true])(
  'loads a page whose instance encloses a layer deleted inside a frame of its component (resumed: %p)',
  async (resumed) => {
    const bytes = await figArchiveOf([
      { guid: guid(1), type: 'DOCUMENT' },
      {
        guid: guid(2),
        type: 'CANVAS',
        parentIndex: { guid: guid(1), position: '!' }
      },
      {
        guid: guid(3),
        type: 'CANVAS',
        parentIndex: { guid: guid(1), position: '"' }
      },
      {
        guid: guid(4),
        type: 'SYMBOL',
        name: 'Icon',
        parentIndex: { guid: guid(3), position: '!' }
      },
      {
        guid: guid(5),
        type: 'TEXT',
        parentIndex: { guid: guid(4), position: '!' },
        textData: { characters: 'Icon' }
      },
      {
        guid: guid(6),
        type: 'SYMBOL',
        name: 'Header',
        parentIndex: { guid: guid(3), position: '"' }
      },
      {
        guid: guid(7),
        type: 'FRAME',
        parentIndex: { guid: guid(6), position: '!' }
      },
      {
        guid: guid(8),
        type: 'INSTANCE',
        parentIndex: { guid: guid(7), position: '!' },
        symbolData: { symbolID: guid(4) }
      },
      {
        guid: guid(9),
        type: 'TEXT',
        parentIndex: { guid: guid(7), position: '"' },
        textData: { characters: 'Label' }
      },
      {
        guid: guid(10),
        type: 'INSTANCE',
        parentIndex: { guid: guid(2), position: '!' },
        symbolData: { symbolID: guid(6) }
      }
    ])
    let session = createFigDocumentSession(bytes)
    session.loadPage('1:3')
    const { graph } = session
    const header = new Map(session.checkpoint().componentIds).get('1:6')
    if (!header) throw new Error('Missing header component')
    const [frame] = graph.getChildren(header)
    graph.deleteNode(graph.getChildren(frame.id)[0].id)
    if (resumed) {
      session = createFigDocumentSession(bytes, {}, { graph, checkpoint: session.checkpoint() })
    }
    session.loadPage('1:2')
    const copy = new Map(session.checkpoint().sources).get('1:10')
    if (!copy) throw new Error('Missing header instance')
    expect(layers(graph, copy)).toEqual(['INSTANCE', '', [['FRAME', '', [['TEXT', 'Label', []]]]]])
  }
)

test('builds again an enclosed component deleted before its enclosing page loads', async () => {
  // Inner holds an instance, whose copied layers take fresh IDs each time they are built.
  const bytes = await enclosedComponentArchive(true, [
    {
      guid: guid(13),
      type: 'INSTANCE',
      parentIndex: { guid: guid(5), position: '"' },
      symbolData: { symbolID: guid(11) }
    }
  ])
  const session = createFigDocumentSession(bytes)
  session.loadPage('1:2')
  const inner = new Map(session.checkpoint().componentIds).get('1:5')
  if (!inner) throw new Error('Missing inner component')
  session.graph.deleteNode(inner)
  session.loadPage('1:3')
  const outer = new Map(session.checkpoint().components).get('1:4')
  if (!outer) throw new Error('Missing outer component')
  for (const { nodeId } of outer.nodes) expect(session.graph.getNode(nodeId)).toBeDefined()
})
