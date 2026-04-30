import type { VectorNetwork, VectorSegment, VectorVertex } from '@open-pencil/core'

export function vectorVertex(x: number, y: number): VectorVertex {
  return { x, y, handleMirroring: 'NONE' }
}

export function vectorSegment(
  start: number,
  end: number,
  tangentStart = { x: 0, y: 0 },
  tangentEnd = { x: 0, y: 0 }
): VectorSegment {
  return { start, end, tangentStart, tangentEnd }
}

export function vectorNetwork(
  vertices: VectorVertex[],
  segments: VectorSegment[],
  regions: VectorNetwork['regions'] = []
): VectorNetwork {
  return { vertices, segments, regions }
}

export function lineNetwork(): VectorNetwork {
  return vectorNetwork([vectorVertex(0, 0), vectorVertex(100, 50)], [vectorSegment(0, 1)])
}

export function triangleNetwork(): VectorNetwork {
  return vectorNetwork(
    [vectorVertex(0, 0), vectorVertex(100, 0), vectorVertex(50, 100)],
    [vectorSegment(0, 1), vectorSegment(1, 2), vectorSegment(2, 0)],
    [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
  )
}
