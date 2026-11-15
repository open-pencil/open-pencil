import { describe, expect, mock, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createGraphEventSubscription, type GraphEventRenderer } from '#core/editor/graph-events'

function createRenderer() {
  const invalidated: string[] = []
  const paths: string[] = []
  const renderer: GraphEventRenderer & { invalidated: string[]; paths: string[] } = {
    invalidateVectorPath: (nodeId: string) => {
      paths.push(nodeId)
    },
    forgetNode: () => undefined,
    invalidateNodePicture: (nodeId: string) => {
      invalidated.push(nodeId)
    },
    tiledScene: {
      invalidateNode: mock(),
      invalidateStructure: mock()
    },
    invalidated,
    paths
  }
  return renderer
}

function setup() {
  const graph = new SceneGraph()
  const renderer = createRenderer()
  const subscription = createGraphEventSubscription({
    getGraph: () => graph,
    getRenderers: () => [renderer],
    scheduleComponentSync: () => undefined,
    requestRender: () => undefined,
    emitEditorEvent: () => undefined
  })
  subscription.subscribeToGraph()
  return { graph, renderer }
}

describe('graph event picture invalidation integration', () => {
  test('updates and deletes invalidate cached raster ownership', () => {
    const { graph, renderer } = setup()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const node = graph.createNode('RECTANGLE', page.id, { width: 100, height: 100 })

    renderer.invalidated.length = 0
    graph.updateNode(node.id, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.5 },
          offset: { x: 4, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(renderer.invalidated).toContain(node.id)

    renderer.invalidated.length = 0
    graph.deleteNode(node.id)
    expect(renderer.invalidated).toContain(node.id)
  })

  test('a change inside a boolean operation drops its cached result', () => {
    const { graph, renderer } = setup()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const boolean = graph.createNode('BOOLEAN_OPERATION', page.id, { booleanOperation: 'UNION' })
    const child = graph.createNode('RECTANGLE', boolean.id, { width: 10, height: 10 })

    renderer.paths.length = 0
    renderer.invalidated.length = 0
    graph.updateNode(child.id, { x: 5 })
    expect(renderer.paths).toContain(boolean.id)
    expect(renderer.invalidated).toContain(boolean.id)

    renderer.paths.length = 0
    renderer.invalidated.length = 0
    graph.deleteNode(child.id)
    expect(renderer.paths).toContain(boolean.id)
    expect(renderer.invalidated).toContain(boolean.id)
  })

  test('isolation changes are evaluated against live tiled chunk topology', () => {
    const { graph, renderer } = setup()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const node = graph.createNode('RECTANGLE', page.id)
    ;(renderer.tiledScene.invalidateNode as ReturnType<typeof mock>).mockClear()

    graph.updateNode(node.id, {
      effects: [
        {
          type: 'LAYER_BLUR',
          visible: true,
          radius: 10,
          spread: 0,
          offset: { x: 0, y: 0 },
          color: { r: 0, g: 0, b: 0, a: 1 }
        }
      ]
    })

    expect(renderer.tiledScene.invalidateNode).toHaveBeenCalledWith(node.id, graph)
  })

  test('reparenting invalidates the moved subtree root', () => {
    const { graph, renderer } = setup()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected default page')
    const first = graph.createNode('FRAME', page.id)
    const second = graph.createNode('FRAME', page.id)
    const child = graph.createNode('RECTANGLE', first.id)

    renderer.invalidated.length = 0
    graph.reparentNode(child.id, second.id)
    expect(renderer.invalidated).toContain(child.id)
  })
})
