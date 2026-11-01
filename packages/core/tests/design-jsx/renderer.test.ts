import { describe, expect, test } from 'bun:test'

import { renderRoots, renderTree } from '@open-pencil/core/design-jsx'
import type { TreeNode } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('renderTree onNode', () => {
  test('reports every element with the layer rendered from it', async () => {
    const graph = new SceneGraph()
    const text: TreeNode = {
      type: 'text',
      props: { name: 'Title' },
      children: ['Hi'],
      source: { line: 2 }
    }
    const root: TreeNode = {
      type: 'frame',
      props: { name: 'Card' },
      children: [text],
      source: { line: 1 }
    }
    const seen: Array<[number | undefined, string]> = []

    const result = await renderTree(graph, root, {
      onNode: (tree, node) => seen.push([tree.source?.line, node.name])
    })

    expect(seen).toEqual([
      [2, 'Title'],
      [1, 'Card']
    ])
    expect(graph.getNode(result.id)?.name).toBe('Card')
  })
})

describe('renderTree sizing', () => {
  test('text in a frame without auto layout takes its content size', async () => {
    const graph = new SceneGraph()
    const root: TreeNode = {
      type: 'frame',
      props: { w: 300, h: 200 },
      children: [{ type: 'text', props: { size: 28 }, children: ['Hello world'] }]
    }

    const result = await renderTree(graph, root)
    const text = graph.getNode(graph.getNode(result.id)?.childIds[0] ?? '')

    expect(text?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(text?.width).not.toBe(100)
    expect(text?.height).toBeLessThan(100)
    expect(text?.width).toBeGreaterThan(text?.height ?? 0)
  })
})

describe('renderRoots positions', () => {
  test('place each root at its own entry, and leave a coordinate the entry omits', async () => {
    const graph = new SceneGraph()
    const frame = (name: string, x?: number): TreeNode => ({
      type: 'frame',
      props: { name, w: 100, h: 50, ...(x !== undefined && { x }) },
      children: []
    })
    const tree: TreeNode = { type: '', props: {}, children: [frame('A'), frame('B', 300)] }

    const [a, b] = await renderRoots(graph, tree, {
      x: 500,
      positions: [
        { x: 10, y: 20 },
        { y: 40 }
      ]
    })

    expect(graph.getNode(a.id)).toMatchObject({ x: 10, y: 20 })
    expect(graph.getNode(b.id)).toMatchObject({ x: 300, y: 40 })
  })
})
