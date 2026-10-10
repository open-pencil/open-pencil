import { describe, expect, test } from 'bun:test'

import { createEditor } from '#core/editor'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Marks layers as read from a .fig file, with the geometry the file saved for them. */
function asSaved(graph: SceneGraph, nodes: SceneNode[]) {
  for (const node of nodes) {
    graph.applyImportedStateDuring(() =>
      graph.updateNode(node.id, {
        source: { ...node.source, format: 'fig', id: node.id },
        derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
      })
    )
  }
}

function savedRow() {
  const editor = createEditor()
  const { graph } = editor
  const row = graph.createNode('FRAME', editor.state.currentPageId, {
    width: 230,
    height: 60,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  })
  const first = graph.createNode('FRAME', row.id, { x: 10, y: 10, width: 100, height: 40 })
  const second = graph.createNode('FRAME', row.id, { x: 120, y: 10, width: 100, height: 40 })
  asSaved(graph, [row, first, second])
  return { editor, row, first, second }
}

describe('a frame read from a .fig file reflows once its layout is edited', () => {
  test('adding auto layout hugs the layer and moves it into the flow', () => {
    for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const editor = createEditor()
      const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
        width: 480,
        height: 360
      })
      const child = editor.graph.createNode('FRAME', frame.id, {
        x: 220,
        y: 150,
        width: 140,
        height: 90
      })
      asSaved(editor.graph, [frame, child])
      editor.setLayoutMode(frame.id, mode)
      expect([frame.width, frame.height, child.x, child.y]).toEqual([140, 90, 0, 0])
      editor.undoAction()
      expect([frame.width, frame.height, child.x, child.y]).toEqual([480, 360, 220, 150])
      editor.dispose()
    }
  })

  test('a new gap spaces the saved layers', () => {
    const { editor, row, first, second } = savedRow()
    editor.updateNodeWithUndo(row.id, { itemSpacing: 20 })
    expect([row.width, first.x, second.x]).toEqual([240, 10, 130])
    editor.dispose()
  })

  test('an unedited frame keeps the geometry the file saved', () => {
    const { editor, row, first, second } = savedRow()
    editor.graph.updateNode(first.id, { name: 'Renamed' })
    editor.runLayoutForNode(row.id)
    expect([row.width, first.x, second.x]).toEqual([230, 10, 120])
    editor.dispose()
  })
})
