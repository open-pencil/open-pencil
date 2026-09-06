import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'

import { FigmaAPI } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('nested instances retain their outer source-child correspondence during sync', () => {
  const source: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL' },
    { guid: guid(2), type: 'SYMBOL' },
    {
      guid: guid(3),
      type: 'INSTANCE',
      parentIndex: { guid: guid(1), position: '!' },
      symbolData: { symbolID: guid(2) }
    },
    { guid: guid(4), type: 'INSTANCE', symbolData: { symbolID: guid(1) } }
  ]
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const outer = graph.createNode('COMPONENT', page.id)
  const inner = graph.createNode('COMPONENT', page.id)
  const sourceChild = graph.createInstance(inner.id, outer.id)
  if (!sourceChild) throw new Error('Missing source instance')
  const occurrence = interpretInstance(source, '1:4')
  const result = materializeInstance(
    graph,
    page.id,
    occurrence,
    new Map([
      ['1:1', outer.id],
      ['1:2', inner.id]
    ]),
    [],
    new Map([[occurrence.children[0], sourceChild.id]])
  )
  const child = graph.getChildren(result.root.id)[0]
  expect(child.componentId).toBe(inner.id)
  graph.updateNode(sourceChild.id, { opacity: 0.5 })
  graph.syncInstances(outer.id)
  expect(graph.getChildren(result.root.id).map((node) => node.id)).toEqual([child.id])
  expect(child.opacity).toBe(0.5)
})

test('swapped nested instances do not regain children from the original component', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const outer = graph.createNode('COMPONENT', page.id)
  const original = graph.createNode('COMPONENT', page.id)
  graph.createNode('TEXT', original.id, { text: 'Original' })
  const replacement = graph.createNode('COMPONENT', page.id)
  const sourceChild = graph.createInstance(original.id, outer.id)
  if (!sourceChild) throw new Error('Missing source instance')
  const occurrence = interpretInstance(
    [
      { guid: guid(1), type: 'SYMBOL' },
      { guid: guid(2), type: 'SYMBOL' },
      {
        guid: guid(3),
        type: 'INSTANCE',
        parentIndex: { guid: guid(1), position: '!' },
        symbolData: { symbolID: guid(2) }
      },
      { guid: guid(4), type: 'INSTANCE', symbolData: { symbolID: guid(1) } }
    ],
    '1:4'
  )
  const result = materializeInstance(
    graph,
    page.id,
    occurrence,
    new Map([
      ['1:1', outer.id],
      ['1:2', replacement.id]
    ]),
    [],
    new Map([[occurrence.children[0], sourceChild.id]])
  )
  const child = graph.getChildren(result.root.id)[0]
  graph.syncInstances(outer.id)
  expect(graph.getChildren(result.root.id).map((node) => node.id)).toEqual([child.id])
  expect(child.componentId).toBe(replacement.id)
  expect(graph.getChildren(child.id)).toHaveLength(0)
})

test('existing component synchronization updates unedited occurrences and preserves a text edit', async () => {
  await initCodec()
  const source: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: 'Default' }
    },
    { guid: guid(3), type: 'INSTANCE', symbolData: { symbolID: guid(1) } }
  ]
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const label = graph.createNode('TEXT', component.id, { text: 'Default' })
  const create = () => {
    const occurrence = interpretInstance(source, '1:3')
    return materializeInstance(
      graph,
      page.id,
      occurrence,
      new Map([['1:1', component.id]]),
      [],
      new Map([[occurrence.children[0], label.id]])
    )
  }
  const first = create()
  const second = create()
  const firstLabel = graph.getChildren(first.root.id)[0]
  const secondLabel = graph.getChildren(second.root.id)[0]
  const api = new FigmaAPI(graph)
  api.wrapNode(firstLabel.id).characters = 'User edit'
  api.wrapNode(label.id).characters = 'Component edit'
  graph.syncInstances(component.id)
  expect(firstLabel.text).toBe('User edit')
  expect(secondLabel.text).toBe('Component edit')
  expect(graph.getChildren(first.root.id)).toHaveLength(1)
  expect(graph.getChildren(second.root.id)).toHaveLength(1)
  const bytes = await exportFigFile(graph)
  const restored = await parseFigFile(bytes.buffer as ArrayBuffer)
  const instanceLabels = [...restored.getAllNodes()]
    .filter((node) => node.type === 'INSTANCE')
    .flatMap((node) => restored.getChildren(node.id).map((child) => child.text))
  expect(instanceLabels.sort()).toEqual(['Component edit', 'User edit'])
})
