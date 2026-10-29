import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  createShapeWithText,
  createSticky,
  generatedFrameKind,
  generatedFrameText,
  layerResizes,
  layerRotates,
  stickySublayers
} from '@open-pencil/scene-graph/generated'

describe('generated frame kinds', () => {
  test('a sticky note edits its body in place, stays upright, and scales by its own handles', () => {
    const graph = new SceneGraph()
    const sticky = createSticky(graph, graph.getPages()[0].id, { text: 'Hi' })
    expect(generatedFrameText(graph, sticky)?.id).toBe(stickySublayers(graph, sticky)?.body.id)
    expect([layerRotates(sticky), layerResizes(sticky)]).toEqual([false, false])
    expect(generatedFrameKind(sticky)?.namedByText).toBe(true)
    expect(generatedFrameKind(sticky)?.complete(graph, sticky)).toBe(true)
  })

  test("a height set outside layout is a shape's given height, and it then keeps it", () => {
    const graph = new SceneGraph()
    const shape = createShapeWithText(graph, graph.getPages()[0].id, { width: 200, height: 100 })
    // A width, or the height it already has, leaves it growing, as in FigJam.
    graph.updateNode(shape.id, { width: 320, height: 100 })
    expect(graph.getNode(shape.id)).toMatchObject({ shapeUserHeight: 100, shapeTruncates: false })
    graph.updateNodePreview(shape.id, { height: 140 })
    expect(graph.getNode(shape.id)).toMatchObject({ shapeUserHeight: 140, shapeTruncates: true })
    // A write that carries the given height itself, as an undo does, keeps it.
    graph.updateNode(shape.id, { height: 180, shapeUserHeight: 120, shapeTruncates: false })
    expect(graph.getNode(shape.id)).toMatchObject({ shapeUserHeight: 120, shapeTruncates: false })
    graph.withLayoutMutations(() => graph.updateNode(shape.id, { height: 500 }))
    expect(graph.getNode(shape.id)).toMatchObject({ shapeUserHeight: 120, shapeTruncates: false })
  })

  test('any other layer has no kind and turns and resizes freely', () => {
    const rectangle = { type: 'RECTANGLE' as const }
    expect(generatedFrameKind(rectangle)).toBeUndefined()
    expect([layerRotates(rectangle), layerResizes(rectangle)]).toEqual([true, true])
  })
})
