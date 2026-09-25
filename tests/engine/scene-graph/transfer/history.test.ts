import { expect, test } from 'bun:test'

import {
  applyGraphTransfer,
  captureTransferredState,
  prepareGraphTransfer,
  SceneGraph
} from '@open-pencil/scene-graph'

test('history captures post-placement geometry and separates reused image ownership', () => {
  const source = new SceneGraph(),
    target = new SceneGraph()
  const root = source.createNode('FRAME', source.getPages()[0].id)
  source.images.set('shared', new Uint8Array([1]))
  source.images.set('new', new Uint8Array([2]))
  target.images.set('shared', new Uint8Array([1]))
  const plan = prepareGraphTransfer({
    source,
    target,
    rootIds: [root.id],
    dependencyPageIds: [],
    parentId: target.getPages()[0].id
  })
  applyGraphTransfer(target, plan)
  target.updateNode(plan.rootIds[0], { x: 120, y: 60 })
  const snapshot = captureTransferredState(target, plan)
  expect(snapshot.nodes[0].props).toMatchObject({ x: 120, y: 60 })
  expect(plan.nodes[0].props.x).toBe(0)
  target.updateNode(plan.rootIds[0], { x: 200 })
  expect(snapshot.nodes[0].props.x).toBe(120)
  target.deleteNode(plan.rootIds[0])
  expect(() => captureTransferredState(target, plan)).toThrow('Missing transferred node')
})
