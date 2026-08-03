import { describe, expect, test } from 'bun:test'

import { SceneGraph, type Color, type GUID, type Rect, type Vector } from '@open-pencil/core'

function firstPageId(graph: SceneGraph): string {
  const [page] = graph.getPages()
  if (!page) throw new Error('SceneGraph did not create a default page')
  return page.id
}

describe('@open-pencil/core root scene-graph type exports', () => {
  test('re-exports primitive scene-graph types from the root barrel', () => {
    const guid: GUID = { sessionID: 1, localID: 2 }
    const color: Color = { r: 1, g: 0.5, b: 0, a: 1 }
    const vector: Vector = { x: 3, y: 4 }
    const rect: Rect = { x: vector.x, y: vector.y, width: 10, height: 20 }

    expect(guid).toEqual({ sessionID: 1, localID: 2 })
    expect(color.a).toBe(1)
    expect(rect.width).toBe(10)
  })

  test('SceneGraph absolute position works through root barrel', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', firstPageId(graph), {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })

    expect(graph.getAbsolutePosition(rect.id)).toEqual({ x: 10, y: 20 })
    expect(graph.getAbsoluteBounds(rect.id)).toEqual({ x: 10, y: 20, width: 30, height: 40 })
  })
})
