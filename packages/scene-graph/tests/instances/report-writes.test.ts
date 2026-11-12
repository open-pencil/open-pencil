import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import { observeWrites } from '../helpers/observe'

test('recordInstanceOverride reports the instance before its overrides change', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  graph.createNode('RECTANGLE', component.id)
  const instance = graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('No instance')
  const copy = graph.getChildren(instance.id)[0]

  const seen = observeWrites(graph)
  recordInstanceOverride(graph, copy.id, ['opacity'])
  seen.stop()

  const kept = seen.before.get(instance.id)
  expect(kept && hasInstanceOverride(kept.overrides, instance.id, copy.id, 'opacity')).toBe(false)
  expect(hasInstanceOverride(instance.instanceOverrides, instance.id, copy.id, 'opacity')).toBe(
    true
  )
  expect(seen.touched.has(instance.id)).toBe(true)
})
