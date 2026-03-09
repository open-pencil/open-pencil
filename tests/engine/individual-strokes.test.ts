import { describe, test, expect } from 'bun:test'

import { SceneGraph, FigmaAPI, sceneNodeToKiwi, type Stroke } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

function rectWithStroke(
  graph: SceneGraph,
  name: string,
  strokeOverrides: Partial<Stroke> = {}
) {
  const stroke: Stroke = {
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 2,
    opacity: 1,
    visible: true,
    align: 'CENTER',
    ...strokeOverrides
  }
  return graph.createNode('RECTANGLE', pageId(graph), {
    name,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    strokes: [stroke]
  })
}

describe('Stroke align', () => {
  test('default stroke align is stored per stroke', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')
    expect(node.strokes[0].align).toBe('CENTER')
  })

  test('stroke align can be set to INSIDE', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R', { align: 'INSIDE' })
    expect(node.strokes[0].align).toBe('INSIDE')
  })

  test('stroke align can be set to OUTSIDE', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R', { align: 'OUTSIDE' })
    expect(node.strokes[0].align).toBe('OUTSIDE')
  })

  test('updating stroke align preserves other stroke properties', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R', { weight: 5, align: 'CENTER' })
    const strokes = [...node.strokes]
    strokes[0] = { ...strokes[0], align: 'INSIDE' }
    graph.updateNode(node.id, { strokes })

    const updated = graph.getNode(node.id)!
    expect(updated.strokes[0].align).toBe('INSIDE')
    expect(updated.strokes[0].weight).toBe(5)
    expect(updated.strokes[0].color).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })
})

describe('Individual stroke weights', () => {
  test('default independentStrokeWeights is false', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), { name: 'R' })
    expect(node.independentStrokeWeights).toBe(false)
    expect(node.borderTopWeight).toBe(0)
    expect(node.borderRightWeight).toBe(0)
    expect(node.borderBottomWeight).toBe(0)
    expect(node.borderLeftWeight).toBe(0)
  })

  test('enable independent stroke weights', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')
    graph.updateNode(node.id, {
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 0,
      borderBottomWeight: 4,
      borderLeftWeight: 0
    })

    const updated = graph.getNode(node.id)!
    expect(updated.independentStrokeWeights).toBe(true)
    expect(updated.borderTopWeight).toBe(2)
    expect(updated.borderRightWeight).toBe(0)
    expect(updated.borderBottomWeight).toBe(4)
    expect(updated.borderLeftWeight).toBe(0)
  })

  test('disable independent stroke weights', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')
    graph.updateNode(node.id, {
      independentStrokeWeights: true,
      borderTopWeight: 2,
      borderRightWeight: 3,
      borderBottomWeight: 4,
      borderLeftWeight: 5
    })
    graph.updateNode(node.id, {
      independentStrokeWeights: false,
      borderTopWeight: 0,
      borderRightWeight: 0,
      borderBottomWeight: 0,
      borderLeftWeight: 0
    })

    const updated = graph.getNode(node.id)!
    expect(updated.independentStrokeWeights).toBe(false)
  })

  test('single side: top only', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')
    graph.updateNode(node.id, {
      independentStrokeWeights: true,
      borderTopWeight: 3,
      borderRightWeight: 0,
      borderBottomWeight: 0,
      borderLeftWeight: 0
    })

    const updated = graph.getNode(node.id)!
    expect(updated.borderTopWeight).toBe(3)
    expect(updated.borderRightWeight).toBe(0)
    expect(updated.borderBottomWeight).toBe(0)
    expect(updated.borderLeftWeight).toBe(0)
  })

  test('individual weights are independent from stroke weight', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R', { weight: 10 })
    graph.updateNode(node.id, {
      independentStrokeWeights: true,
      borderTopWeight: 1,
      borderRightWeight: 2,
      borderBottomWeight: 3,
      borderLeftWeight: 4
    })

    const updated = graph.getNode(node.id)!
    expect(updated.strokes[0].weight).toBe(10)
    expect(updated.borderTopWeight).toBe(1)
    expect(updated.borderRightWeight).toBe(2)
    expect(updated.borderBottomWeight).toBe(3)
    expect(updated.borderLeftWeight).toBe(4)
  })
})

describe('Instance sync with stroke weights', () => {
  test('syncInstances propagates independentStrokeWeights', () => {
    const graph = new SceneGraph()
    const comp = graph.createNode('COMPONENT', pageId(graph), {
      name: 'Comp',
      strokes: [
        {
          color: { r: 1, g: 0, b: 0, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'INSIDE'
        }
      ],
      independentStrokeWeights: true,
      borderTopWeight: 3,
      borderRightWeight: 0,
      borderBottomWeight: 3,
      borderLeftWeight: 0
    })

    const instance = graph.createInstance(comp.id, pageId(graph))!
    expect(instance.independentStrokeWeights).toBe(true)
    expect(instance.borderTopWeight).toBe(3)
    expect(instance.borderBottomWeight).toBe(3)

    graph.updateNode(comp.id, { borderTopWeight: 5 })
    graph.syncInstances(comp.id)

    const synced = graph.getNode(instance.id)!
    expect(synced.borderTopWeight).toBe(5)
  })
})

describe('Kiwi serialization', () => {
  test('exports stroke align from first stroke', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R', { align: 'OUTSIDE' })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 0 },
      0,
      { value: 100 },
      graph,
      blobs
    )

    expect(changes[0].strokeAlign).toBe('OUTSIDE')
  })

  test('exports default CENTER align', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 0 },
      0,
      { value: 100 },
      graph,
      blobs
    )

    expect(changes[0].strokeAlign).toBe('CENTER')
  })

  test('exports individual stroke weights', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')
    graph.updateNode(node.id, {
      independentStrokeWeights: true,
      borderTopWeight: 1,
      borderRightWeight: 2,
      borderBottomWeight: 3,
      borderLeftWeight: 4
    })

    const updated = graph.getNode(node.id)!
    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      updated,
      { sessionID: 1, localID: 0 },
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, unknown>[]

    expect(changes[0].borderStrokeWeightsIndependent).toBe(true)
    expect(changes[0].borderTopWeight).toBe(1)
    expect(changes[0].borderRightWeight).toBe(2)
    expect(changes[0].borderBottomWeight).toBe(3)
    expect(changes[0].borderLeftWeight).toBe(4)
  })

  test('does not export individual weights when disabled', () => {
    const graph = new SceneGraph()
    const node = rectWithStroke(graph, 'R')

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      node,
      { sessionID: 1, localID: 0 },
      0,
      { value: 100 },
      graph,
      blobs
    ) as Record<string, unknown>[]

    expect(changes[0].borderStrokeWeightsIndependent).toBeUndefined()
    expect(changes[0].borderTopWeight).toBeUndefined()
  })
})

describe('FigmaAPI stroke properties', () => {
  test('strokeTopWeight sets independentStrokeWeights', () => {
    const api = new FigmaAPI(new SceneGraph())
    const rect = api.createRectangle()
    rect.strokes = [
      {
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 2,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
    ]
    rect.strokeTopWeight = 5

    const raw = api.graph.getNode(rect.id)!
    expect(raw.independentStrokeWeights).toBe(true)
    expect(raw.borderTopWeight).toBe(5)
  })

  test('strokeBottomWeight getter returns borderBottomWeight', () => {
    const api = new FigmaAPI(new SceneGraph())
    const frame = api.createFrame()
    api.graph.updateNode(frame.id, { borderBottomWeight: 7 })
    expect(frame.strokeBottomWeight).toBe(7)
  })

  test('strokeAlign getter returns first stroke align', () => {
    const api = new FigmaAPI(new SceneGraph())
    const rect = api.createRectangle()
    rect.strokes = [
      {
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 2,
        opacity: 1,
        visible: true,
        align: 'INSIDE'
      }
    ]
    expect(rect.strokeAlign).toBe('INSIDE')
  })

  test('strokeAlign setter updates stroke', () => {
    const api = new FigmaAPI(new SceneGraph())
    const rect = api.createRectangle()
    rect.strokes = [
      {
        color: { r: 0, g: 0, b: 0, a: 1 },
        weight: 2,
        opacity: 1,
        visible: true,
        align: 'CENTER'
      }
    ]
    rect.strokeAlign = 'OUTSIDE'

    const raw = api.graph.getNode(rect.id)!
    expect(raw.strokes[0].align).toBe('OUTSIDE')
  })

  test('all four individual stroke weight setters', () => {
    const api = new FigmaAPI(new SceneGraph())
    const frame = api.createFrame()
    frame.strokeTopWeight = 1
    frame.strokeRightWeight = 2
    frame.strokeBottomWeight = 3
    frame.strokeLeftWeight = 4

    expect(frame.strokeTopWeight).toBe(1)
    expect(frame.strokeRightWeight).toBe(2)
    expect(frame.strokeBottomWeight).toBe(3)
    expect(frame.strokeLeftWeight).toBe(4)

    const raw = api.graph.getNode(frame.id)!
    expect(raw.independentStrokeWeights).toBe(true)
  })
})
