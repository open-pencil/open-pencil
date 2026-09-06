import { expect, test } from 'bun:test'

import { interpretComponent, interpretInstance } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren
} from '#fig/instance-overrides/source-children'

import { FigmaAPI } from '@open-pencil/core'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('derives repeated nested child correspondence from materialized component occurrences', async () => {
  const changes: NodeChange[] = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      textData: { characters: 'Label' }
    },
    { guid: guid(3), type: 'SYMBOL' },
    ...[4, 5].map((id) => ({
      guid: guid(id),
      type: 'INSTANCE' as const,
      parentIndex: { guid: guid(3), position: String(id) },
      symbolData: { symbolID: guid(1) }
    })),
    { guid: guid(6), type: 'INSTANCE', symbolData: { symbolID: guid(3) } }
  ]
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const inner = interpretComponent(changes, '1:1')
  const innerGraph = materializeInstance(graph, page.id, inner, new Map())
  const components = new Map([['1:1', { occurrence: inner, materialized: innerGraph }]])
  const ids = new Map([['1:1', innerGraph.root.id]])
  const outer = interpretComponent(changes, '1:3')
  const outerGraph = materializeInstance(
    graph,
    page.id,
    outer,
    ids,
    [],
    mapInstanceSourceChildren(outer, components)
  )
  components.set('1:3', { occurrence: outer, materialized: outerGraph })
  ids.set('1:3', outerGraph.root.id)
  const occurrence = interpretInstance(changes, '1:6')
  const mapping = mapInstanceSourceChildren(occurrence, components)
  const result = materializeInstance(graph, page.id, occurrence, ids, [], mapping)
  const [first, second] = occurrence.children
  expect(mapping.get(first)).not.toBe(mapping.get(second))
  expect(mapping.get(first.children[0])).toBe(mapping.get(second.children[0]))
  const before = graph.getChildren(result.root.id).map((node) => node.id)
  graph.syncInstances(outerGraph.root.id)
  expect(graph.getChildren(result.root.id).map((node) => node.id)).toEqual(before)
  linkInstanceSourceChildren(occurrence, result, components)
  const api = new FigmaAPI(graph)
  const firstLabel = result.nodes.get(first.children[0])
  const secondLabel = result.nodes.get(second.children[0])
  if (!firstLabel || !secondLabel) throw new Error('Missing labels')
  api.wrapNode(firstLabel.id).characters = 'First occurrence'
  api.wrapNode(secondLabel.id).characters = 'Second occurrence'
  graph.updateNode(result.root.id, { name: 'Repeated instances acceptance' })
  await initCodec()
  const bytes = await exportFigFile(graph)
  const restored = await parseFigFile(bytes.buffer as ArrayBuffer)
  const root = [...restored.getAllNodes()].find(
    (node) => node.name === 'Repeated instances acceptance'
  )
  if (!root) throw new Error('Missing restored root')
  expect(
    restored.getChildren(root.id).map((child) => restored.getChildren(child.id)[0]?.text)
  ).toEqual(['First occurrence', 'Second occurrence'])
})
