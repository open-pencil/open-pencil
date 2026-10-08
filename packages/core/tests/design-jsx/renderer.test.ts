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
