import { expect, test } from 'bun:test'

import { interpretInstance } from '#fig/instance-overrides/interpret'
import { materializeInstance } from '#fig/instance-overrides/materialize-instance'

import { FigmaAPI } from '@open-pencil/core'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

const guid = (localID: number) => ({ sessionID: 1, localID })

test('occurrence text size replaces source cache and is invalidated by a text edit', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'TEXT',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 67, y: 24 },
      textData: { characters: 'Source' },
      derivedTextData: { layoutSize: { x: 67, y: 24 } }
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(1) },
      derivedSymbolData: [{ guidPath: { guids: [guid(2)] }, size: { x: 213, y: 24 } }]
    }
  ] as NodeChange[]
  const occurrence = interpretInstance(changes, '1:3', { derivedBounds: true })
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const result = materializeInstance(graph, page.id, occurrence, new Map([['1:1', component.id]]))
  const label = graph.getChildren(result.root.id)[0]
  expect(label.derivedLayout).toEqual({ width: 213, height: 24 })
  new FigmaAPI(graph).wrapNode(label.id).characters = 'Edited'
  expect(label.derivedLayout).toBeNull()
})

test('uses explicit derived geometry with its bounds instead of the oversized source path', () => {
  const changes = [
    { guid: guid(1), type: 'SYMBOL' },
    {
      guid: guid(2),
      type: 'VECTOR',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 2650, y: 44 },
      fillGeometry: [{ commandsBlob: 0, windingRule: 'NONZERO' }]
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      symbolData: { symbolID: guid(1) },
      derivedSymbolData: [
        {
          guidPath: { guids: [guid(2)] },
          size: { x: 375, y: 39 },
          fillGeometry: [{ commandsBlob: 1, windingRule: 'NONZERO' }]
        }
      ]
    }
  ] as NodeChange[]
  const before = structuredClone(changes)
  const node = interpretInstance(changes, '1:3', { derivedBounds: true }).children[0]
  expect(node.properties.size).toEqual({ x: 375, y: 39 })
  expect(node.properties.fillGeometry).toEqual([{ commandsBlob: 1, windingRule: 'NONZERO' }])
  expect(interpretInstance(changes, '1:3').children[0].properties.size).toEqual({ x: 2650, y: 44 })
  expect(changes).toEqual(before)
})
