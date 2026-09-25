import { expect, test } from 'bun:test'

import { loadPageTransaction } from '#fig/document/load-transaction'
import type { AssemblyState } from '#fig/document/materialize'

import { SceneGraph } from '@open-pencil/scene-graph'

test('failed page mutation restores changed existing instance indexes and object identity', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const a = graph.createNode('COMPONENT', page.id)
  const b = graph.createNode('COMPONENT', page.id)
  const instance = graph.createInstance(a.id, page.id)
  if (!instance) throw new Error('Missing instance')
  const state: AssemblyState = {
    graph,
    sources: new Map([['instance', instance.id]]),
    components: new Map(),
    componentIds: new Map(),
    savedSizeNodes: new Set()
  }
  let events = 0
  graph.onNodeEvents({
    updated: () => {
      events++
    }
  })
  expect(() =>
    loadPageTransaction(
      state,
      {
        contentIds: new Set(['instance']),
        ancestorIds: new Set(),
        missingIds: new Set(),
        externalPreferredKeys: new Set()
      },
      () => {
        state.sources.set('partial', instance.id)
        state.componentIds.set('partial', b.id)
        state.savedSizeNodes.add(instance.id)
        graph.createNode('INSTANCE', page.id, { componentId: b.id })
        graph.updateNode(instance.id, { componentId: b.id, name: 'Partial' })
        throw new Error('Fail after update')
      }
    )
  ).toThrow('Fail after update')
  expect(graph.getNode(instance.id)).toBe(instance)
  expect(instance.componentId).toBe(a.id)
  expect(graph.instanceIndex.get(a.id)?.has(instance.id)).toBe(true)
  expect(graph.instanceIndex.get(b.id)?.has(instance.id) ?? false).toBe(false)
  expect(state.sources.has('partial')).toBe(false)
  expect(state.componentIds.has('partial')).toBe(false)
  expect(state.savedSizeNodes.has(instance.id)).toBe(false)
  expect(graph.getChildren(page.id)).toHaveLength(3)
  expect(events).toBe(0)
})
