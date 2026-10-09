import { describe, expect, test } from 'bun:test'

import { renderTree } from '@open-pencil/core/design-jsx'
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
