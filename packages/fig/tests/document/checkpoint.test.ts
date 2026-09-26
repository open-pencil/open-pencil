import { expect, test } from 'bun:test'

import { guid } from '#fig-tests/helpers/guid'
import { checkpointComponent, restoreComponentCheckpoint } from '#fig/document/component/checkpoint'
import { interpretComponent } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'

import { SceneGraph } from '@open-pencil/scene-graph'

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
