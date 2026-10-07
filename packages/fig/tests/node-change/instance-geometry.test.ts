import { expect, test } from 'bun:test'

import type { DerivedSymbolOverride } from '#fig/instance-overrides/types'
import { sceneNodeToKiwi } from '#fig/node-change/index'
import { snapshotInstanceGeometry } from '#fig/node-change/instance/geometry'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { stringToGuid, UNSET_GUID } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'

import { expectDefined } from '../helpers/assert'

function fixture() {
  const graph = new SceneGraph()
  const component = graph.createNode('COMPONENT', graph.getPages()[0].id)
  const source = graph.createNode('RECTANGLE', component.id, { width: 10, height: 20 })
  const owner = expectDefined(graph.createInstance(component.id, graph.getPages()[0].id))
  return { graph, source, owner }
}

test('geometry snapshots merge retained fields without authoring claims or mutating retained data', () => {
  const { graph, source, owner } = fixture()
  const guidPath = { guids: [stringToGuid(source.id)] }
  const retained: DerivedSymbolOverride[] = [
    { guidPath, fontSize: 12 },
    { guidPath, size: { x: 1, y: 1 } },
    { fontSize: 24 }
  ]
  const before = structuredClone(retained)
  const result = snapshotInstanceGeometry(graph, owner, stringToGuid, retained, (node) => ({
    size: { x: node.width, y: node.height }
  }))
  expect(result).toEqual([{ fontSize: 24 }, { guidPath, fontSize: 12, size: { x: 10, y: 20 } }])
  expect(retained).toEqual(before)
  expect(owner.instanceOverrides.self.size).toBe(0)
})

test('geometry snapshots reject ambiguous occurrence addresses', () => {
  const { graph, source, owner } = fixture()
  graph.createNode('RECTANGLE', owner.id, { componentId: source.id })
  expect(() =>
    snapshotInstanceGeometry(graph, owner, stringToGuid, [], (node) => ({
      size: { x: node.width, y: node.height }
    }))
  ).toThrow('Ambiguous instance geometry address')
})

// Figma saves layers that have no override key with the unset GUID, so many siblings share it.
test('layers saved with the unset override key keep distinct geometry addresses', () => {
  const at = (localID: number) => ({ sessionID: 1, localID })
  const transform = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
  const { graph } = materializeDocument([
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document', phase: 'CREATED' },
    {
      guid: { sessionID: 0, localID: 1 },
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
      type: 'CANVAS',
      name: 'Page',
      phase: 'CREATED'
    },
    {
      guid: at(1),
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
      type: 'SYMBOL',
      name: 'Card',
      phase: 'CREATED',
      size: { x: 100, y: 40 },
      transform
    },
    ...['Title', 'Body'].map((name, index) => ({
      guid: at(2 + index),
      overrideKey: { ...UNSET_GUID },
      parentIndex: { guid: at(1), position: index === 0 ? '!' : '"' },
      type: 'ROUNDED_RECTANGLE',
      name,
      phase: 'CREATED',
      size: { x: 100, y: 20 },
      transform: { ...transform, m12: index * 20 }
    })),
    {
      guid: at(4),
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
      type: 'INSTANCE',
      name: 'Card use',
      phase: 'CREATED',
      size: { x: 100, y: 40 },
      transform,
      symbolData: { symbolID: at(1) }
    }
  ] as NodeChange[])
  const page = graph.getPages()[0]
  const instance = expectDefined(
    graph.getChildren(page.id).find((node) => node.type === 'INSTANCE')
  )
  expect(graph.getChildren(instance.id).map((node) => node.overrideKey)).toEqual([null, null])

  const [change] = sceneNodeToKiwi(
    instance,
    { sessionID: 0, localID: 1 },
    1,
    { value: 10 },
    graph,
    []
  )
  const derived = (change.derivedSymbolData ?? []) as DerivedSymbolOverride[]
  const paths = derived.map((entry) => JSON.stringify(entry.guidPath?.guids))
  expect(paths).toHaveLength(2)
  expect(new Set(paths).size).toBe(2)
})
