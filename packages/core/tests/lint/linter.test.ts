import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createLinter } from '#core/lint'

describe('lintGraph roots', () => {
  test('lints a layer inside another root once, with its real parents', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 200, height: 100 })
    const inner = graph.createNode('FRAME', card.id, { name: 'Frame 1', width: 50, height: 50 })
    const lint = (roots: string[]) =>
      createLinter({
        rules: ['no-default-names'],
        config: { rules: { 'no-default-names': 'warning' } }
      })
        .lintGraph(graph, roots)
        .messages.map(({ nodeId, nodePath }) => ({ nodeId, nodePath }))

    const fromPage = lint([page.id])

    expect(fromPage.find(({ nodeId }) => nodeId === inner.id)?.nodePath).toContain('Card')
    // Listed before its page, the inner frame still reports once and under its parents.
    expect(lint([inner.id, page.id])).toEqual(fromPage)
  })
})
