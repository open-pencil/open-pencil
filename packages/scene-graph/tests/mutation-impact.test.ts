import { describe, expect, test } from 'bun:test'

import { collectSceneMutation, mutationLayoutScopeIds, SceneGraph } from '@open-pencil/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

function transferSetup() {
  const graph = new SceneGraph()
  const page = pageId(graph)
  const left = graph.createNode('FRAME', page)
  const right = graph.createNode('FRAME', page)
  const child = graph.createNode('RECTANGLE', left.id)
  return { graph, left, right, child }
}

describe('scene mutation impact', () => {
  test('collects created and updated nodes with current parents', async () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const { result, impact } = await collectSceneMutation(graph, () => {
      const frame = graph.createNode('FRAME', page)
      graph.updateNode(frame.id, { width: 240 })
      return frame.id
    })

    expect(impact.createdNodeIds).toContain(result)
    expect(impact.changedNodeIds).toContain(result)
    expect(impact.currentParentIds).toContain(page)
    expect(mutationLayoutScopeIds(impact)).toContain(result)
  })

  test('retains the old parent when deleting', async () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph))
    const child = graph.createNode('RECTANGLE', parent.id)

    const { impact } = await collectSceneMutation(graph, () => graph.deleteNode(child.id))

    expect(impact.deletedNodeIds).toContain(child.id)
    expect(impact.previousParentIds).toContain(parent.id)
  })

  test('retains old and new parents when reparenting', async () => {
    const { graph, left, right, child } = transferSetup()

    const { impact } = await collectSceneMutation(graph, () =>
      graph.reparentNode(child.id, right.id)
    )

    expect(impact.previousParentIds).toContain(left.id)
    expect(impact.currentParentIds).toContain(right.id)
  })

  test('retains old and new parents when reorderChild transfers a node', async () => {
    const { graph, left, right, child } = transferSetup()

    const { impact } = await collectSceneMutation(graph, () =>
      graph.reorderChild(child.id, right.id, 0)
    )

    expect(child.parentId).toBe(right.id)
    expect(left.childIds).not.toContain(child.id)
    expect(right.childIds).toContain(child.id)
    expect(impact.previousParentIds).toContain(left.id)
    expect(impact.currentParentIds).toContain(right.id)
  })

  test('does not detach insertChildAt targets when the destination is missing', () => {
    const { graph, left, child } = transferSetup()

    graph.insertChildAt(child.id, 'missing', 0)

    expect(child.parentId).toBe(left.id)
    expect(left.childIds).toContain(child.id)
  })

  test('rejects cyclic insertChildAt destinations without mutating the tree', () => {
    const { graph, left, child } = transferSetup()
    const grandchild = graph.createNode('FRAME', child.id)

    const originalPageChildren = [...(graph.getNode(pageId(graph))?.childIds ?? [])]
    const originalLeftChildren = [...left.childIds]
    const originalLeftParentId = left.parentId
    const originalChildParentId = child.parentId

    graph.insertChildAt(left.id, left.id, 0)
    graph.insertChildAt(left.id, grandchild.id, 0)

    expect(left.parentId).toBe(originalLeftParentId)
    expect(left.childIds).toEqual(originalLeftChildren)
    expect(child.parentId).toBe(originalChildParentId)
    expect(graph.getNode(pageId(graph))?.childIds).toEqual(originalPageChildren)
    expect(grandchild.childIds).not.toContain(left.id)
  })

  test('retains old and new parents when insertChildAt transfers a node', async () => {
    const { graph, left, right, child } = transferSetup()

    const { impact } = await collectSceneMutation(graph, () =>
      graph.insertChildAt(child.id, right.id, 0)
    )

    expect(impact.previousParentIds).toContain(left.id)
    expect(impact.currentParentIds).toContain(right.id)
  })

  test('unsubscribes when an operation throws', async () => {
    const graph = new SceneGraph()
    const rejection = collectSceneMutation(graph, async () => {
      throw new Error('failed')
    })
    await rejection.then(
      () => {
        throw new Error('Expected rejection')
      },
      (error: unknown) => expect(error).toMatchObject({ message: 'failed' })
    )

    graph.createNode('RECTANGLE', pageId(graph))
    const { impact } = await collectSceneMutation(graph, () => undefined)
    expect(impact.changedNodeIds.size).toBe(0)
  })
})
