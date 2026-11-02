import { expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { setInstanceOverride } from '@open-pencil/scene-graph/instances/overrides'

import { expectDefined } from '../helpers/assert'

const solid = (r: number, g: number, b: number): SceneNode['fills'] => [
  { type: 'SOLID', color: { r, g, b, a: 1 }, opacity: 1, visible: true }
]

/**
 * A Row component holding a To do badge, and an instance of Row whose badge is swapped to Done,
 * as a status column swaps its badges. `template` prepares the badge inside Row.
 */
function swappedBadge(template?: (graph: SceneGraph, badge: SceneNode) => void) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const todo = graph.createNode('COMPONENT', page, {
    fills: solid(1, 0.55, 0),
    fillStyleId: 'style-todo',
    boundVariables: { 'fills/0/color': 'orange' },
    variableBindingScales: { 'fills/0/color': 1 }
  })
  const done = graph.createNode('COMPONENT', page, {
    fills: solid(0.1, 0.75, 0.3),
    fillStyleId: 'style-done',
    boundVariables: { 'fills/0/color': 'green' },
    variableBindingScales: { 'fills/0/color': 2 }
  })
  const row = graph.createNode('COMPONENT', page)
  const badge = expectDefined(
    graph.createInstance(todo.id, row.id, { x: 17, visible: false, boundVariables: { opacity: 'faded' } })
  )
  template?.(graph, badge)
  const outer = expectDefined(graph.createInstance(row.id, page))
  const target = graph.getChildren(outer.id)[0]
  const swap = (component: SceneNode) => {
    graph.updateNode(target.id, { componentId: component.id })
    setInstanceOverride(outer.instanceOverrides, outer.id, target.id, 'componentId', component.id)
    graph.syncInstance(outer.id)
  }
  swap(done)
  return { graph, todo, done, badge, outer, target, swap }
}

test('a swapped badge takes the fill, style and bindings its new component gives, as in Figma', () => {
  const { graph, done, badge, outer, target } = swappedBadge()
  for (let pass = 0; pass < 2; pass++) {
    expect(target.fills).toEqual(done.fills)
    expect(target.fillStyleId).toBe('style-done')
    expect(target.boundVariables).toEqual({ 'fills/0/color': 'green', opacity: 'faded' })
    expect(target.variableBindingScales['fills/0/color']).toBe(2)
    // What the template set on the badge, other than its fill, stays.
    expect(target.x).toBe(badge.x)
    expect(target.visible).toBe(false)
    graph.syncInstance(outer.id)
  }
})

test('an edit to the new component reaches the swapped badge', () => {
  const { graph, done, outer, target } = swappedBadge()
  graph.updateNode(done.id, { fills: [], boundVariables: {} })
  graph.syncInstance(outer.id)
  expect(target.fills).toEqual([])
  expect(target.boundVariables).toEqual({ opacity: 'faded' })
})

test('a fill the template overrides on the badge survives the swap, bound or plain, as in Figma', () => {
  const bound = swappedBadge((graph, badge) => {
    graph.updateNode(badge.id, { boundVariables: { 'fills/0/color': 'purple' } })
    setInstanceOverride(badge.instanceOverrides, badge.id, badge.id, 'boundVariables/fills/0/color', true)
  })
  expect(bound.target.boundVariables['fills/0/color']).toBe('purple')
  const plain = swappedBadge((graph, badge) => {
    graph.updateNode(badge.id, { fills: solid(0.5, 0, 1), boundVariables: {} })
    setInstanceOverride(badge.instanceOverrides, badge.id, badge.id, 'fills', badge.fills)
    setInstanceOverride(badge.instanceOverrides, badge.id, badge.id, 'boundVariables/fills/0/color', true)
  })
  expect(plain.target.fills).toEqual(solid(0.5, 0, 1))
  expect(plain.target.boundVariables['fills/0/color']).toBeUndefined()
})

test('the swapped badge keeps its own fill, binding and style overrides through component edits', () => {
  const { graph, todo, done, outer, target } = swappedBadge()
  graph.updateNode(target.id, {
    fills: todo.fills,
    boundVariables: { 'fills/0/color': 'own', opacity: 'faded' },
    variableBindingScales: { 'fills/0/color': 3 },
    fillStyleId: 'style-own'
  })
  setInstanceOverride(target.instanceOverrides, target.id, target.id, 'fills', target.fills)
  setInstanceOverride(target.instanceOverrides, target.id, target.id, 'boundVariables/fills/0/color', true)
  setInstanceOverride(target.instanceOverrides, target.id, target.id, 'fillStyleId', 'style-own')
  graph.updateNode(done.id, { fills: solid(0, 0, 1), boundVariables: { 'fills/0/color': 'blue' } })
  graph.syncInstance(outer.id)
  expect(target.fills).toEqual(todo.fills)
  expect(target.boundVariables).toEqual({ 'fills/0/color': 'own', opacity: 'faded' })
  expect(target.variableBindingScales['fills/0/color']).toBe(3)
  expect(target.fillStyleId).toBe('style-own')
})

test('its own plain fill override keeps the swapped badge unbound', () => {
  const { graph, outer, target } = swappedBadge()
  graph.updateNode(target.id, { fills: solid(0.5, 0, 1), boundVariables: { opacity: 'faded' } })
  setInstanceOverride(target.instanceOverrides, target.id, target.id, 'fills', target.fills)
  graph.syncInstance(outer.id)
  expect(target.fills).toEqual(solid(0.5, 0, 1))
  expect(target.boundVariables).toEqual({ opacity: 'faded' })
})

test('clearing its own fill binding leaves the swapped badge unbound', () => {
  const { graph, outer, target } = swappedBadge()
  graph.updateNode(target.id, { boundVariables: { opacity: 'faded' }, variableBindingScales: {} })
  setInstanceOverride(target.instanceOverrides, target.id, target.id, 'boundVariables', true)
  graph.syncInstance(outer.id)
  expect(target.boundVariables).toEqual({ opacity: 'faded' })
  expect(target.variableBindingScales['fills/0/color']).toBeUndefined()
})

test('a fill or style the outer instance overrides on the swapped badge wins', () => {
  const { graph, done, outer, target } = swappedBadge()
  graph.updateNode(target.id, { fills: [], fillStyleId: 'style-outer' })
  setInstanceOverride(outer.instanceOverrides, outer.id, target.id, 'fills', [])
  setInstanceOverride(outer.instanceOverrides, outer.id, target.id, 'fillStyleId', 'style-outer')
  for (let pass = 0; pass < 2; pass++) {
    graph.syncInstance(outer.id)
    expect(target.fills).toEqual([])
    expect(target.fillStyleId).toBe('style-outer')
  }
  outer.instanceOverrides.descendants.get(target.id)?.delete('fills')
  graph.syncInstance(outer.id)
  expect(target.fills).toEqual(done.fills)
  expect(target.fillStyleId).toBe('style-outer')
})

test('swapping the badge back gives it the template’s fill again', () => {
  const { badge, todo, target, swap } = swappedBadge()
  swap(todo)
  expect(target.fills).toEqual(badge.fills)
  expect(target.fillStyleId).toBe('style-todo')
})
