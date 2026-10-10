import { describe, expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

function serialize(overrides: Partial<SceneNode>) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const node = graph.createNode('RECTANGLE', page.id, overrides)
  return sceneNodeToKiwi(node, { sessionID: 1, localID: 1 }, 0, { value: 2 }, graph, [])[0]
}

// Copied from live Figma, 2026-10-10: a locked layer carries only `targetAspectRatio`.
describe('Figma aspect ratio lock', () => {
  test('imports the stored size of a locked layer', () => {
    const props = nodeChangeToProps(
      {
        type: 'RECTANGLE',
        size: { x: 300, y: 110 },
        targetAspectRatio: { value: { x: 300, y: 110 } }
      } as NodeChange,
      []
    )
    expect(props.targetAspectRatio).toEqual({ x: 300, y: 110 })
    expect(nodeChangeToProps({ type: 'RECTANGLE' } as NodeChange, []).targetAspectRatio).toBeNull()
  })

  test('exports the stored size and leaves free layers without it', () => {
    expect(
      serialize({
        width: 200,
        height: 100,
        targetAspectRatio: { x: 200, y: 100 }
      })
    ).toMatchObject({ targetAspectRatio: { value: { x: 200, y: 100 } } })
    expect(serialize({ width: 200, height: 100 }).targetAspectRatio).toBeUndefined()
  })
})
