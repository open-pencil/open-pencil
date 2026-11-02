import { expect, test } from 'bun:test'

import { resolveVectorNetwork } from '#fig/node-change/vector/geometry'
import { encodeVectorNetworkBlob } from '#fig/node-change/vector/network'

import type { NodeChange } from '@lawha/kiwi/fig/codec'
import type { Vector } from '@lawha/scene-graph/primitives'

/** A node whose path was saved at `normalized` and is drawn at `size`, as Figma saves copies. */
function savedPath(normalized: Vector, size: Vector) {
  const blob = encodeVectorNetworkBlob({
    vertices: [
      { x: 0, y: 0 },
      { x: normalized.x, y: normalized.y }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  })
  const node: NodeChange = {
    size,
    vectorData: { vectorNetworkBlob: 0, normalizedSize: normalized }
  }
  return resolveVectorNetwork(node, [blob])
}

test('a saved path scales to the size it is drawn at, a straight line along its length only', () => {
  const ends = (normalized: Vector, size: Vector) =>
    savedPath(normalized, size)?.vertices.map(({ x, y }) => [x, y])
  expect(ends({ x: 12, y: 12 }, { x: 4, y: 4 })).toEqual([
    [0, 0],
    [4, 4]
  ])
  // A line in an instance scaled to 18 of 24 px, as Figma desktop 126 saves it.
  expect(ends({ x: 9, y: 0 }, { x: 6.75, y: 0 })).toEqual([
    [0, 0],
    [6.75, 0]
  ])
  expect(ends({ x: 0, y: 16 }, { x: 0, y: 12 })).toEqual([
    [0, 0],
    [0, 12]
  ])
})
