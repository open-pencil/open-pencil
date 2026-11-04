import { expect, test } from 'bun:test'

import { propertyBinding } from '#fig-tests/helpers/component-props'
import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { guid } from '#fig-tests/helpers/guid'
import { checkpointComponent, restoreComponentCheckpoint } from '#fig/document/component/checkpoint'
import { interpretComponent } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'

import { createFigDocumentSession } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

test('checkpoint recovery keeps the effective fill of a swapped instance on a lazy page', async () => {
  const paint = (r: number): NonNullable<NodeChange['fillPaints']> => [
    { type: 'SOLID', color: { r, g: 1 - r, b: 0, a: 1 }, visible: true, opacity: 1 }
  ]
  const records: NodeChange[] = [
    { guid: guid(0), type: 'DOCUMENT' },
    { guid: guid(1), type: 'CANVAS', parentIndex: { guid: guid(0), position: '!' } },
    {
      guid: guid(2),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '!' },
      fillPaints: paint(1)
    },
    {
      guid: guid(3),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '"' },
      fillPaints: paint(0)
    },
    {
      guid: guid(4),
      type: 'SYMBOL',
      parentIndex: { guid: guid(1), position: '#' },
      componentPropDefs: [
        { id: guid(90), type: 'INSTANCE_SWAP', initialValue: { guidValue: guid(2) } }
      ]
    },
    {
      guid: guid(5),
      type: 'INSTANCE',
      parentIndex: { guid: guid(4), position: '!' },
      fillPaints: paint(1),
      symbolData: { symbolID: guid(2) },
      ...propertyBinding(guid(90), 'OVERRIDDEN_SYMBOL_ID')
    },
    {
      guid: guid(6),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '$' },
      symbolData: { symbolID: guid(4) },
      componentPropAssignments: [{ defID: guid(90), value: { guidValue: guid(3) } }]
    }
  ]
  const bytes = await figArchiveOf(records)
  const initial = createFigDocumentSession(bytes)
  const recovered = createFigDocumentSession(
    bytes,
    {},
    { graph: initial.graph, checkpoint: initial.checkpoint() }
  )
  recovered.loadPage('1:1')
  const root = recovered.graph.getNode(new Map(recovered.checkpoint().sources).get('1:6') ?? '')
  if (!root) throw new Error('Missing recovered instance')
  expect(recovered.graph.getChildren(root.id)[0].fills[0].color.g).toBe(1)
})

function setup() {
  const occurrence = interpretComponent(
    [
      { guid: guid(1), type: 'SYMBOL' },
      {
        guid: guid(2),
        type: 'TEXT',
        parentIndex: { guid: guid(1), position: '!' },
        textData: { characters: 'Original' }
      }
    ],
    '1:1'
  )
  const graph = new SceneGraph()
  const materialized = materializeInstance(graph, graph.getPages()[0].id, occurrence, new Map())
  const checkpoint = checkpointComponent({ occurrence, materialized })
  return { graph, occurrence, materialized, checkpoint }
}

test('compact checkpoint reconnects source paths without overwriting live edits', () => {
  const { graph, occurrence, materialized, checkpoint } = setup()
  const child = graph.getChildren(materialized.root.id)[0]
  graph.updateNode(child.id, { text: 'Edited' })
  const restored = restoreComponentCheckpoint(graph, occurrence, structuredClone(checkpoint))
  expect(restored.materialized.nodes.get(occurrence.children[0])).toBe(child)
  expect(child.text).toBe('Edited')
  expect(checkpoint.nodes[1].path).toEqual(['1:2'])
})

for (const corruption of ['missing', 'duplicate', 'path', 'component', 'root'] as const) {
  test(`reports ${corruption} checkpoint handling before graph mutation`, () => {
    const { graph, occurrence, checkpoint } = setup()
    const before = corruption === 'missing' ? null : structuredClone([...graph.nodes])
    if (corruption === 'missing') {
      graph.deleteNode(checkpoint.nodes.at(-1)?.nodeId ?? '')
      checkpoint.nodes.pop()
    }
    if (corruption === 'duplicate') checkpoint.nodes.push(checkpoint.nodes[1])
    if (corruption === 'path') checkpoint.nodes[1].path = ['missing']
    if (corruption === 'component') checkpoint.nodes[1].mainComponentId = 'other'
    if (corruption === 'root') checkpoint.rootId = checkpoint.nodes[1].nodeId
    if (corruption === 'missing')
      expect(() => restoreComponentCheckpoint(graph, occurrence, checkpoint)).not.toThrow()
    else expect(() => restoreComponentCheckpoint(graph, occurrence, checkpoint)).toThrow()
    if (before) expect([...graph.nodes]).toEqual(before)
  })
}
