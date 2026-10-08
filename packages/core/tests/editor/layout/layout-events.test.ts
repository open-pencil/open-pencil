import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

function hugRow(graph: SceneGraph, children: number) {
  const row = graph.createNode('FRAME', graph.getPages()[0].id, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 4
  })
  for (let i = 0; i < children; i++) {
    graph.createNode('RECTANGLE', row.id, { width: 10 + i, height: 10 })
  }
  return row
}

describe('layout and graph events', () => {
  test('laying out an unchanged frame again writes nothing', () => {
    const graph = new SceneGraph()
    const row = hugRow(graph, 5)
    computeLayout(graph, row.id)

    let updates = 0
    const unbind = graph.onNodeEvents({ updated: () => updates++ })
    computeLayout(graph, row.id)
    unbind()
    expect(updates).toBe(0)
  })

  test('a layout pass that moves many layers asks for one render', async () => {
    const editor = createEditor()
    const row = hugRow(editor.graph, 50)
    await Promise.resolve()

    let renders = 0
    const unbind = editor.onEditorEvent('render:requested', () => renders++)
    computeLayout(editor.graph, row.id)
    expect(renders).toBe(0)
    await Promise.resolve()
    unbind()
    expect(renders).toBe(1)
    editor.dispose()
  })
})
