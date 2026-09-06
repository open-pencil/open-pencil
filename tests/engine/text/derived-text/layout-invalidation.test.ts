import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

for (const preview of [false, true]) {
  test(`text layout cache invalidation preserves supplied replacements (preview=${preview})`, () => {
    const graph = new SceneGraph()
    const node = graph.createNode('TEXT', graph.getPages()[0].id, {
      text: 'Initial',
      derivedLayout: { width: 67, height: 24 }
    })
    const update = preview ? graph.updateNodePreview.bind(graph) : graph.updateNode.bind(graph)
    update(node.id, { opacity: 0.5 })
    expect(node.derivedLayout).toEqual({ width: 67, height: 24 })
    update(node.id, { text: 'Replacement', derivedLayout: { width: 120, height: 24 } })
    expect(node.derivedLayout).toEqual({ width: 120, height: 24 })
    update(node.id, { fontSize: 20 })
    expect(node.derivedLayout).toBeNull()
  })
}
