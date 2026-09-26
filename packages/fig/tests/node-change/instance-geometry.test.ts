import { expect, test } from 'bun:test'

import type { DerivedSymbolOverride } from '#fig/instance-overrides/types'
import { snapshotInstanceGeometry } from '#fig/node-change/instance-geometry'

import { stringToGuid } from '@open-pencil/kiwi/fig/guid'
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
