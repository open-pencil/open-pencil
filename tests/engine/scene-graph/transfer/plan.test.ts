import { expect, test } from 'bun:test'

import { materializeFigFragment } from '@open-pencil/fig'
import { prepareGraphTransfer, applyGraphTransfer, SceneGraph } from '@open-pencil/scene-graph'

import fixture from '#tests/fixtures/nested-binding-ownership-records.json'

test('prepares a real FIG fragment without mutating the destination', () => {
  const fragment = materializeFigFragment(
    fixture.nodeChanges,
    fixture.blobs.map((value) => Uint8Array.fromBase64(value))
  )
  const target = new SceneGraph()
  const before = [...target.nodes.keys()]
  const plan = prepareGraphTransfer({
    source: fragment.graph,
    rootIds: fragment.rootIds,
    dependencyPageIds: fragment.dependencyPageIds,
    target,
    parentId: target.getPages()[0].id
  })
  expect([...target.nodes.keys()]).toEqual(before)
  expect(plan.rootIds).toHaveLength(fragment.rootIds.length)
  expect(plan.nodes.length).toBeGreaterThan(plan.rootIds.length)
  const ids = new Set(plan.nodes.map((node) => node.id))
  for (const node of plan.nodes)
    if (node.props.componentId) expect(ids.has(node.props.componentId)).toBe(true)
  expect(plan.variables.length).toBeGreaterThan(0)
  applyGraphTransfer(target, plan)
  expect(plan.rootIds.every((id) => target.getNode(id))).toBe(true)
  for (const node of plan.nodes) {
    const inserted = target.getNode(node.id)
    expect(inserted?.parentId).toBe(node.parentId)
    if (inserted?.componentId) expect(target.getNode(inserted.componentId)).toBeDefined()
  }
  expect(target.variables.size).toBe(plan.variables.length)
  expect(target.activeMode).toEqual(plan.activeModes)
})
