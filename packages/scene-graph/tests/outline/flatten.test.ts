import { expect, test } from 'bun:test'

import { segmentRuns } from '#scene-graph/outline/flatten'

const zero = { x: 0, y: 0 }

// An open path stored out of order, its second half first, is one run through the vertex its
// segments share, as the canvas strokes it, not two runs that each take caps there.
test('chains an open path stored out of order into one run', () => {
  const network = {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ],
    segments: [
      { start: 1, end: 2, tangentStart: zero, tangentEnd: zero },
      { start: 0, end: 1, tangentStart: zero, tangentEnd: zero }
    ],
    regions: []
  }
  expect(segmentRuns(network, 0.25)).toEqual([
    [
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ]
  ])
})
