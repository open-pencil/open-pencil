import { expect, test } from 'bun:test'

import { SceneGraph } from '#core/scene-graph'
import { updateNodePreview } from '#core/scene-graph/preview'

type GraphWithSubtreeVersion = SceneGraph & {
  subtreeVersion?: Map<string, number>
}

function createFixture() {
  const graph = new SceneGraph()
  const page = graph.addPage('P1')
  const frameA = graph.createNode('FRAME', page.id, {
    name: 'Frame A',
    width: 200,
    height: 200
  })
  const leaf = graph.createNode('RECTANGLE', frameA.id, {
    name: 'Leaf',
    width: 40,
    height: 40
  })

  return { graph, page, frameA, leaf }
}

function subtreeVersionOf(graph: SceneGraph, nodeId: string) {
  return (graph as GraphWithSubtreeVersion).subtreeVersion?.get(nodeId)
}

test('updateNodePreview bumps subtree versions for the node and its ancestors on simple mutation', () => {
  // Given
  const { graph, page, frameA, leaf } = createFixture()
  const beforeLeaf = subtreeVersionOf(graph, leaf.id) ?? 0
  const beforeFrame = subtreeVersionOf(graph, frameA.id) ?? 0
  const beforePage = subtreeVersionOf(graph, page.id) ?? 0
  const beforeRoot = subtreeVersionOf(graph, graph.rootId) ?? 0

  // When
  updateNodePreview(graph, leaf.id, { x: 10 })

  // Then
  expect(subtreeVersionOf(graph, leaf.id)).toBe(beforeLeaf + 1)
  expect(subtreeVersionOf(graph, frameA.id)).toBe(beforeFrame + 1)
  expect(subtreeVersionOf(graph, page.id)).toBe(beforePage + 1)
  expect(subtreeVersionOf(graph, graph.rootId)).toBe(beforeRoot + 1)
  expect(graph.positionPreviewVersion).toBe(1)
})

test('updateNodePreview bumps both old and new ancestor chains on reparent preview', () => {
  // Given
  const { graph, page, frameA, leaf } = createFixture()
  const frameB = graph.createNode('FRAME', page.id, {
    name: 'Frame B',
    width: 200,
    height: 200
  })
  const beforeLeaf = subtreeVersionOf(graph, leaf.id) ?? 0
  const beforeFrameA = subtreeVersionOf(graph, frameA.id) ?? 0
  const beforeFrameB = subtreeVersionOf(graph, frameB.id) ?? 0
  const beforePage = subtreeVersionOf(graph, page.id) ?? 0

  // When
  updateNodePreview(graph, leaf.id, { parentId: frameB.id })

  // Then
  expect(subtreeVersionOf(graph, leaf.id)).toBe(beforeLeaf + 1)
  expect(subtreeVersionOf(graph, frameA.id)).toBe(beforeFrameA + 1)
  expect(subtreeVersionOf(graph, frameB.id)).toBe(beforeFrameB + 1)
  expect(subtreeVersionOf(graph, page.id)).toBe(beforePage + 1)
})

test('updateNodePreview does not bump sibling subtree versions for unrelated chains', () => {
  // Given
  const { graph, frameA, leaf } = createFixture()
  const page = graph.addPage('P2')
  const frameC = graph.createNode('FRAME', page.id, {
    name: 'Frame C',
    width: 200,
    height: 200
  })
  const otherLeaf = graph.createNode('RECTANGLE', frameC.id, {
    name: 'Other Leaf',
    width: 40,
    height: 40
  })
  const beforeLeaf = subtreeVersionOf(graph, leaf.id) ?? 0
  const beforeFrameA = subtreeVersionOf(graph, frameA.id) ?? 0
  const beforeOtherLeaf = subtreeVersionOf(graph, otherLeaf.id)
  const beforeFrameC = subtreeVersionOf(graph, frameC.id)

  // When
  updateNodePreview(graph, leaf.id, { x: 10 })

  // Then
  expect(subtreeVersionOf(graph, leaf.id)).toBe(beforeLeaf + 1)
  expect(subtreeVersionOf(graph, frameA.id)).toBe(beforeFrameA + 1)
  expect(subtreeVersionOf(graph, otherLeaf.id)).toBe(beforeOtherLeaf)
  expect(subtreeVersionOf(graph, frameC.id)).toBe(beforeFrameC)
})

test('updateNodePreview keeps bumping positionPreviewVersion across repeated preview mutations', () => {
  // Given
  const { graph, leaf } = createFixture()
  const beforeLeaf = subtreeVersionOf(graph, leaf.id) ?? 0

  // When
  updateNodePreview(graph, leaf.id, { x: 10 })
  updateNodePreview(graph, leaf.id, { x: 20 })
  updateNodePreview(graph, leaf.id, { x: 30 })

  // Then
  expect(graph.positionPreviewVersion).toBe(3)
  expect(subtreeVersionOf(graph, leaf.id)).toBe(beforeLeaf + 3)
})

test('updateNodePreview captures the old parent chain before applying reparent changes', () => {
  // Given
  const { graph, page, frameA, leaf } = createFixture()
  const frameB = graph.createNode('FRAME', page.id, {
    name: 'Frame B',
    width: 200,
    height: 200
  })
  const beforeFrameA = subtreeVersionOf(graph, frameA.id) ?? 0

  // When
  updateNodePreview(graph, leaf.id, { parentId: frameB.id })

  // Then
  expect(subtreeVersionOf(graph, frameA.id)).toBe(beforeFrameA + 1)
})
