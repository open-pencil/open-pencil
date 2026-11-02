import { expect, test } from 'bun:test'

import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { guid } from '#fig-tests/helpers/guid'
import { checkpointComponent } from '#fig/document/component/checkpoint'
import { createFigDocumentSession, materializeDocument } from '#fig/document/materialize'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

test('constructs nested definitions once under their actual component parent', () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'a' } },
    { guid: guid(4), type: 'SYMBOL', parentIndex: { guid: guid(3), position: 'a' } },
    {
      guid: guid(5),
      type: 'TEXT',
      parentIndex: { guid: guid(4), position: 'a' },
      textData: { characters: 'Nested' }
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: 'b' },
      symbolData: { symbolID: guid(4) }
    }
  ]
  const { graph, sources } = materializeDocument(changes)
  const outer = sources.get('1:3')
  const inner = sources.get('1:4')
  const instance = sources.get('1:6')
  if (!outer || !inner || !instance) throw new Error('Missing nodes')
  expect(graph.getNode(inner)?.parentId).toBe(outer)
  expect(graph.getNode(instance)?.componentId).toBe(inner)
  expect([...graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')).toHaveLength(2)
})

function nestedComponentRecords(): NodeChange[] {
  return [
    { guid: guid(1), type: 'DOCUMENT' },
    { guid: guid(2), type: 'CANVAS', parentIndex: { guid: guid(1), position: '!' } },
    { guid: guid(3), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'a' } },
    { guid: guid(4), type: 'SYMBOL', parentIndex: { guid: guid(3), position: 'a' } },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(4), position: 'a' },
      symbolData: { symbolID: guid(6) }
    },
    { guid: guid(6), type: 'SYMBOL', parentIndex: { guid: guid(2), position: 'b' } },
    {
      guid: guid(7),
      type: 'TEXT',
      parentIndex: { guid: guid(6), position: 'a' },
      textData: { characters: 'Nested instance' }
    }
  ]
}

test('keeps nested component instance descendants available to linking and checkpoints', () => {
  const { graph, components } = materializeDocument(nestedComponentRecords())
  const outer = components.get('1:3')
  const inner = components.get('1:4')
  const source = components.get('1:6')
  if (!outer || !inner || !source) throw new Error('Missing components')
  const instance = graph.getChildren(inner.materialized.root.id)[0]
  const label = graph.getChildren(instance.id)[0]
  expect(instance.type).toBe('INSTANCE')
  expect(instance.componentId).toBe(source.materialized.root.id)
  expect(label.text).toBe('Nested instance')
  expect(graph.getChildren(outer.materialized.root.id)).toEqual([inner.materialized.root])
  expect([...graph.getAllNodes()].filter((node) => node.type === 'INSTANCE')).toEqual([instance])
  expect(checkpointComponent(outer).nodes.map((node) => node.nodeId)).toEqual([
    outer.materialized.root.id,
    inner.materialized.root.id,
    instance.id,
    label.id
  ])
  const sourceLabel = graph.getChildren(source.materialized.root.id)[0]
  graph.updateNode(sourceLabel.id, { text: 'Updated' })
  graph.syncInstances(source.materialized.root.id)
  expect(graph.getChildren(instance.id)).toEqual([label])
  expect(label.text).toBe('Updated')
})

test('expands an instance of the enclosing component down to the nested instance it holds', () => {
  const { graph, components } = materializeDocument([
    ...nestedComponentRecords(),
    {
      guid: guid(8),
      type: 'INSTANCE',
      parentIndex: { guid: guid(2), position: 'c' },
      symbolData: {
        symbolID: guid(3),
        symbolOverrides: [
          { guidPath: { guids: [guid(5), guid(7)] }, textData: { characters: 'Overridden' } }
        ]
      }
    } as NodeChange
  ])
  const outer = components.get('1:3')
  const source = components.get('1:6')
  if (!outer || !source) throw new Error('Missing components')
  const placed = graph
    .getChildren(graph.getPages()[0].id)
    .find((node) => node.componentId === outer.materialized.root.id)
  if (!placed) throw new Error('Missing placed instance')
  const nested = graph.getChildren(graph.getChildren(placed.id)[0].id)[0]
  expect(nested.componentId).toBe(source.materialized.root.id)
  expect(graph.getChildren(nested.id)[0].text).toBe('Overridden')
  const sourceLabel = graph.getChildren(source.materialized.root.id)[0]
  graph.updateNode(sourceLabel.id, { text: 'Updated' })
  graph.syncInstances(source.materialized.root.id)
  expect(graph.getChildren(nested.id)[0].text).toBe('Overridden')
})

test.each([
  ['1:2', '1:8'],
  ['1:8', '1:2']
])(
  'resumes nested definitions after loading %s, then loads %s without duplicating nodes',
  async (first, second) => {
    const records: NodeChange[] = [
      ...nestedComponentRecords(),
      { guid: guid(8), type: 'CANVAS', parentIndex: { guid: guid(1), position: 'b' } },
      {
        guid: guid(9),
        type: 'INSTANCE',
        parentIndex: { guid: guid(8), position: 'a' },
        symbolData: { symbolID: guid(4) }
      }
    ]
    const bytes = await figArchiveOf(records)
    const initial = createFigDocumentSession(bytes)
    initial.loadPage(first)
    const before = initial.checkpoint()
    const resumed = createFigDocumentSession(
      bytes,
      {},
      { graph: initial.graph, checkpoint: before }
    )
    expect(resumed.checkpoint()).toEqual(before)
    const existing = [...initial.graph.getAllNodes()]
    resumed.loadPage(second)
    for (const node of existing) expect(resumed.graph.getNode(node.id)).toBe(node)
    const source = new Map(resumed.checkpoint().sources)
    const instance = resumed.graph.getNode(source.get('1:9') ?? '')
    if (!instance) throw new Error('Missing page instance')
    const nested = resumed.graph.getChildren(instance.id)[0]
    expect(nested.type).toBe('INSTANCE')
    expect(resumed.graph.getChildren(nested.id)[0].text).toBe('Nested instance')
    expect(
      [...resumed.graph.getAllNodes()].filter((node) => node.type === 'COMPONENT')
    ).toHaveLength(3)
  }
)
