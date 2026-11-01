import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
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

describe('FigJam layers', () => {
  // A sticky note's body, author line, and fill are FigJam's fixed choices, not design decisions.
  test('leaves sticky notes and what they generate out of every rule', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const sticky = editor.createStickyNote(page, { x: 200, y: 200 })
    const frame = editor.graph.createNode('FRAME', page, { name: 'Frame 1', width: 50, height: 50 })
    const linted = createLinter({ preset: 'strict' }).lintGraph(editor.graph).messages
    const insideSticky = new Set([sticky.id, ...sticky.childIds])
    expect(linted.filter(({ nodeId }) => insideSticky.has(nodeId))).toEqual([])
    expect(linted.some(({ nodeId }) => nodeId === frame.id)).toBe(true)
  })

  test("a sticky note's sublayer is left out when it is a root, as in the page's walk", () => {
    const editor = createEditor()
    const sticky = editor.createStickyNote(editor.state.currentPageId, { x: 200, y: 200 })
    const linted = createLinter({ preset: 'strict' }).lintGraph(editor.graph, [...sticky.childIds])
    expect(linted.messages).toEqual([])
  })
})
