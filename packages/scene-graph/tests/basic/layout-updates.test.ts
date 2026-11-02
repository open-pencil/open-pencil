import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { rect } from './helpers'

/** Records each published update with whether it arrived while layout was still applying. */
function recordUpdates(graph: SceneGraph) {
  const updates: { id: string; changes: Partial<SceneNode>; duringLayout: boolean }[] = []
  graph.onNodeEvents({
    updated: (id, changes) =>
      updates.push({ id, changes: { ...changes }, duringLayout: graph.isApplyingLayout })
  })
  return updates
}

describe('updates made by layout', () => {
  test('are published once, with the values the layout ended on', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)
    const updates = recordUpdates(graph)

    graph.withLayoutMutations(() => {
      graph.updateNode(id, { width: 40 })
      graph.updateNode(id, { width: 60, height: 30 })
      expect(updates).toEqual([])
    })

    expect(updates).toEqual([{ id, changes: { width: 60, height: 30 }, duringLayout: true }])
  })

  test('are not published for values layout changed and then put back', () => {
    // Bottom-up layout sizes a frame on its own, then its parent's pass sizes it back.
    const graph = new SceneGraph()
    const id = rect(graph, 'Content', 8, 0)
    const { height } = graph.getNode(id) ?? { height: 0 }
    const updates = recordUpdates(graph)

    graph.withLayoutMutations(() => {
      graph.updateNode(id, { x: -1, height: 36 })
      graph.updateNode(id, { x: 8, height })
    })

    expect(updates).toEqual([])
    expect(graph.getNode(id)?.x).toBe(8)
  })

  test('still publish a value written as it already was', () => {
    // A preview shows its layout in place, then commits by writing those values again.
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)
    const updates = recordUpdates(graph)

    graph.withLayoutMutations(() => graph.updateNode(id, { x: 0 }))

    expect(updates).toEqual([{ id, changes: { x: 0 }, duringLayout: true }])
  })

  test('are published when the outermost layout ends', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)
    const updates = recordUpdates(graph)

    graph.withLayoutMutations(() => {
      graph.withLayoutMutations(() => graph.updateNode(id, { x: 20 }))
      expect(updates).toEqual([])
    })

    expect(updates).toEqual([{ id, changes: { x: 20 }, duringLayout: true }])
  })

  test('are still published when layout throws, since the layers already changed', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)
    const updates = recordUpdates(graph)

    expect(() =>
      graph.withLayoutMutations(() => {
        graph.updateNode(id, { y: 12 })
        throw new Error('Layout failed')
      })
    ).toThrow('Layout failed')

    expect(updates).toEqual([{ id, changes: { y: 12 }, duringLayout: true }])
    expect(graph.isApplyingLayout).toBe(false)
  })

  test('leave edits outside layout published as they happen', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)
    const updates = recordUpdates(graph)

    graph.updateNode(id, { x: 5 })
    graph.updateNode(id, { x: 0 })

    expect(updates.map(({ changes }) => changes)).toEqual([{ x: 5 }, { x: 0 }])
  })
})

describe('geometry layout writes after an edit', () => {
  const edited = (graph: SceneGraph, id: string) => graph.getNode(id)?.source.editedFields

  test('count as edited, so formats save them', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)

    graph.withLayoutMutations(() => graph.updateNode(id, { y: 12, primaryAxisSizing: 'FIXED' }))

    expect(edited(graph, id)).toEqual(['y'])
  })

  test('do not count when layout lays out what the document already holds', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)

    graph.applyDerivedLayoutDuring(() =>
      graph.withLayoutMutations(() => graph.updateNode(id, { y: 12 }))
    )
    graph.preserveSourceMetadataDuring(() =>
      graph.withLayoutMutations(() => graph.updateNode(id, { x: 4 }))
    )

    expect(edited(graph, id)).toEqual([])
  })

  test('do not count for values layout changed and then put back', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 8, 0)

    graph.withLayoutMutations(() => {
      graph.updateNode(id, { x: -1 })
      graph.updateNode(id, { x: 8 })
    })

    expect(edited(graph, id)).toEqual([])
  })

  test('count for a value written as it already was, as a preview commits what it showed', () => {
    const graph = new SceneGraph()
    const id = rect(graph, 'Card', 0, 0)

    graph.withLayoutMutations(() => graph.updateNode(id, { x: 0 }))

    expect(edited(graph, id)).toEqual(['x'])
  })
})
