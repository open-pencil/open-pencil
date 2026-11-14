import { expect, test } from 'bun:test'

import { addOpenSegmentsToPath, svgPathSink } from '@open-pencil/scene-graph/paths'

const zero = { x: 0, y: 0 }
const line = (start: number, end: number) => ({
  start,
  end,
  tangentStart: zero,
  tangentEnd: zero
})

// Two segments between the same two vertices leave the first two segments no clue which end a
// walk began at; the chain keeps the vertex its walk started from, so each segment draws once.
test('draws a chain that starts with two segments between the same vertices from its own start', () => {
  const vertices = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 },
    { x: 10, y: 10 }
  ]
  const segments = [line(0, 1), line(0, 1), line(0, 2), line(2, 3), line(3, 0)]
  const parts: string[] = []
  addOpenSegmentsToPath(svgPathSink(parts), segments, vertices)
  expect(parts.join('')).toBe('M0 0L10 0L0 0L0 10L10 10L0 0Z')
})
