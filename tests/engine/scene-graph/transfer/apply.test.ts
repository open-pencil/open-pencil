import { expect, test } from 'bun:test'

import {
  applyGraphTransfer,
  prepareGraphTransfer,
  SceneGraph,
  CommittedGraphEventError
} from '@open-pencil/scene-graph'

function setup() {
  const source = new SceneGraph(),
    target = new SceneGraph()
  const root = source.createNode('FRAME', source.getPages()[0].id)
  source.createNode('RECTANGLE', root.id)
  const collection = source.createCollection('Spacing')
  source.createVariable('Spacing', 'FLOAT', collection.id, 12)
  source.images.set('existing', new Uint8Array([1]))
  source.images.set('new', new Uint8Array([2]))
  target.images.set('existing', new Uint8Array([1]))
  const plan = prepareGraphTransfer({
    source,
    target,
    rootIds: [root.id],
    dependencyPageIds: [],
    parentId: target.getPages()[0].id
  })
  return { target, plan }
}

test('transfer events see the complete graph and repeated insertion cannot overwrite it', () => {
  const { target, plan } = setup()
  target.onNodeEvents({
    created: () => expect(target.getChildren(plan.rootIds[0])).toHaveLength(1)
  })
  applyGraphTransfer(target, plan)
  expect(() => applyGraphTransfer(target, plan)).toThrow('Transfer identity collision')
})

test('transfer rolls back inserted nodes and buffered events on mutation failure', () => {
  const { target, plan } = setup()
  const before = [...target.nodes.keys()]
  let events = 0
  target.onNodeEvents({ created: () => events++ })
  const create = target.createNodeWithId.bind(target)
  let calls = 0
  target.createNodeWithId = (...args) => {
    if (++calls === 2) throw new Error('Injected mutation failure')
    return create(...args)
  }
  expect(() => applyGraphTransfer(target, plan)).toThrow('Injected mutation failure')
  expect([...target.nodes.keys()]).toEqual(before)
  expect(target.getChildren(target.getPages()[0].id)).toHaveLength(0)
  expect(events).toBe(0)
  expect(target.variables.size).toBe(0)
  expect(target.variableCollections.size).toBe(0)
  expect(target.activeMode.size).toBe(0)
  expect([...target.images]).toEqual([['existing', new Uint8Array([1])]])
})

test('tampered resource ownership cannot change an existing destination collection', () => {
  const { target, plan } = setup()
  const existing = target.createCollection('Existing')
  plan.variables[0].collectionId = existing.id
  expect(() => applyGraphTransfer(target, plan)).toThrow('Invalid variable membership')
  expect(existing.variableIds).toEqual([])
  expect(target.variableCollections.size).toBe(1)
})

for (const corruption of ['binding', 'override', 'topology'] as const) {
  test(`commit rejects tampered ${corruption} references before inserting resources`, () => {
    const { target, plan } = setup()
    if (corruption === 'binding') plan.nodes[0].props.boundVariables = { paddingLeft: 'missing' }
    if (corruption === 'override')
      plan.nodes[0].props.instanceOverrides?.descendants.set('missing', new Map())
    if (corruption === 'topology') plan.rootIds.push(plan.nodes[1].id)
    const before = [...target.nodes.keys()]
    expect(() => applyGraphTransfer(target, plan)).toThrow()
    expect([...target.nodes.keys()]).toEqual(before)
    expect(target.variables.size).toBe(0)
    expect(target.variableCollections.size).toBe(0)
  })
}

test('observer failure reports committed transfer instead of rolling it back', () => {
  const { target, plan } = setup()
  target.onNodeEvents({
    created: () => {
      throw new Error('Observer')
    }
  })
  expect(() => applyGraphTransfer(target, plan)).toThrow(CommittedGraphEventError)
  expect(target.getChildren(plan.rootIds[0])).toHaveLength(1)
})
