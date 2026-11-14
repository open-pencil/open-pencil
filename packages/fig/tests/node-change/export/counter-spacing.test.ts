import { expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function serialize(overrides: Partial<SceneNode>) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('FRAME', page.id, {
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    itemSpacing: 8,
    ...overrides
  })
  return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
}

// Figma saves NaN while the space between wrapped lines follows the item spacing, and its plugin
// API reads that as `counterAxisSpacing: null` set (Figma desktop 126).
test('a counter spacing that follows the item spacing reads and saves as Figma keeps it', () => {
  const read = (stackCounterSpacing?: number) =>
    nodeChangeToProps(
      { type: 'FRAME', stackMode: 'HORIZONTAL', stackCounterSpacing } as NodeChange,
      []
    ).counterAxisSpacing
  expect(read(Number.NaN)).toBeNull()
  expect(read(12)).toBe(12)
  expect(read()).toBe(0)

  expect(serialize({ counterAxisSpacing: null }).stackCounterSpacing).toBeNaN()
  expect(serialize({ counterAxisSpacing: 12 }).stackCounterSpacing).toBe(12)
})
