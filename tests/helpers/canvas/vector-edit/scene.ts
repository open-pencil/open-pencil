import type { SceneGraph, VectorNetwork } from '@lawha/scene-graph'

// The browser loads this module itself, so it imports types only.
const STRAIGHT = { x: 0, y: 0 }
const TRIANGLE: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 100 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: STRAIGHT, tangentEnd: STRAIGHT },
    { start: 1, end: 2, tangentStart: STRAIGHT, tangentEnd: STRAIGHT },
    { start: 2, end: 0, tangentStart: STRAIGHT, tangentEnd: STRAIGHT }
  ],
  regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }]
}

/** A component holding a triangle, and an instance of it, whose copy draws the component's path. */
export function createComponentVectorScene(graph: SceneGraph, pageId: string) {
  const card = graph.createNode('COMPONENT', pageId, { x: 100, y: 100, width: 120, height: 120 })
  const vector = graph.createNode('VECTOR', card.id, {
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    vectorNetwork: structuredClone(TRIANGLE)
  })
  const instance = graph.createInstance(card.id, pageId, { x: 300, y: 100 })
  const copy = instance ? graph.getChildren(instance.id)[0] : undefined
  if (!copy) throw new Error('Expected an instance copy')
  return { vector: vector.id, copy: copy.id }
}
