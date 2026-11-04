import { expect, test } from 'bun:test'

import { guid } from '#core-tests/helpers/fig/guid'

import { interpretInstance, materializeInstance } from '@open-pencil/fig/instance-overrides'
import { encodePathCommandsBlob } from '@open-pencil/fig/node-change'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { geometryBlobBounds } from '@open-pencil/scene-graph/geometry'

// A 20 x 20 outline, as the component saved it (the encoder flips y).
const OUTLINE = encodePathCommandsBlob([
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: 20, y: 0 },
  { type: 'L', x: 20, y: -20 },
  { type: 'L', x: 0, y: -20 },
  { type: 'Z' }
])

/** The outline's width after the instance, placed at `placed` and scaled by `uniform`, is read back. */
function reopenedOutlineWidth(uniform: number, placed: number, constraint: string): number {
  const changes = [
    { guid: guid(1), type: 'SYMBOL', size: { x: 24, y: 24 } },
    {
      guid: guid(2),
      type: 'VECTOR',
      parentIndex: { guid: guid(1), position: '!' },
      size: { x: 20, y: 20 },
      transform: { m00: 1, m01: 0, m02: 2, m10: 0, m11: 1, m12: 2 },
      horizontalConstraint: constraint,
      verticalConstraint: constraint,
      fillGeometry: [{ commandsBlob: 0, windingRule: 'NONZERO' }]
    },
    {
      guid: guid(3),
      type: 'INSTANCE',
      size: { x: placed, y: placed },
      symbolData: { symbolID: guid(1), uniformScaleFactor: uniform }
    }
  ] as NodeChange[]
  const occurrence = interpretInstance(changes, '1:3')
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const component = graph.createNode('COMPONENT', page.id)
  const result = materializeInstance(graph, page.id, occurrence, new Map([['1:1', component.id]]), {
    blobs: [OUTLINE]
  })
  const vector = graph.getChildren(result.root.id)[0]
  const bounds = geometryBlobBounds(vector.fillGeometry)
  expect(bounds).not.toBeNull()
  return bounds?.width ?? 0
}

test('an outline follows the instance scale', () => {
  expect(reopenedOutlineWidth(2, 48, 'MIN')).toBeCloseTo(40)
})

test('an outline follows a constraint that scales the vector back to its component size', () => {
  // Placed at 2x, then resized to the component's own width: SCALE halves the vector again.
  expect(reopenedOutlineWidth(2, 24, 'SCALE')).toBeCloseTo(20)
})

test('an outline follows a constraint resize of an instance that is not scaled', () => {
  expect(reopenedOutlineWidth(1, 36, 'SCALE')).toBeCloseTo(30)
})
