import { describe, expect, test } from 'bun:test'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'

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
  // Opening a file lays its pages out.
  editor.runLayoutForNode(row.id)
  return { editor, row, first, second }
}

/** Three saved Hug rows, each inside the last, around one 10 px layer. */
function savedNest() {
  const editor = createEditor()
  const { graph } = editor
  const hug = {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  } as const
  const outer = graph.createNode('FRAME', editor.state.currentPageId, {
    ...hug,
    width: 70,
    height: 70
  })
  const middle = graph.createNode('FRAME', outer.id, {
    ...hug,
    x: 10,
    y: 10,
    width: 50,
    height: 50
  })
  const inner = graph.createNode('FRAME', middle.id, {
    ...hug,
    x: 10,
    y: 10,
    width: 30,
    height: 30
  })
  const leaf = graph.createNode('RECTANGLE', inner.id, { x: 10, y: 10, width: 10, height: 10 })
  asSaved(graph, [outer, middle, inner, leaf])
  editor.runLayoutForNode(outer.id)
  return { editor, outer, middle, inner }
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

  test('a new layer in the flow moves the saved ones along', () => {
    const { editor, row, first, second } = savedRow()
    const added = editor.graph.createNode('RECTANGLE', row.id, { width: 50, height: 40 })
    editor.graph.insertChildAt(added.id, row.id, 0)
    editor.runLayoutForNode(row.id)
    expect([row.width, added.x, first.x, second.x]).toEqual([290, 10, 70, 180])
    editor.dispose()
  })

  test('removing a layer closes the gap it leaves', () => {
    const { editor, row, first, second } = savedRow()
    editor.graph.deleteNode(first.id)
    editor.runLayoutForNode(row.id)
    expect([row.width, second.x]).toEqual([120, 10])
    editor.dispose()
  })

  test('a layer that ignores auto layout leaves the flow, and one added that way does not join it', () => {
    const { editor, row, first, second } = savedRow()
    const pinned = editor.graph.createNode('RECTANGLE', row.id, {
      x: 300,
      y: 0,
      width: 20,
      height: 20,
      layoutPositioning: 'ABSOLUTE'
    })
    editor.runLayoutForNode(row.id)
    expect([row.width, first.x, second.x, pinned.x]).toEqual([230, 10, 120, 300])
    editor.setLayoutPositioning([first.id], 'ABSOLUTE')
    expect([row.width, first.x, second.x]).toEqual([120, 10, 10])
    editor.dispose()
  })

  test('a layer added to a nested flow resizes every Hug frame around it', () => {
    const { editor, outer, middle, inner } = savedNest()
    editor.graph.createNode('RECTANGLE', inner.id, { width: 10, height: 10 })
    editor.runLayoutForNode(inner.id)
    expect([inner.width, middle.width, outer.width]).toEqual([50, 70, 90])
    editor.dispose()
  })

  test('a gap changed in a nested flow resizes every Hug frame around it, until undone', () => {
    const { editor, outer, middle, inner } = savedNest()
    editor.updateNodeWithUndo(inner.id, { paddingLeft: 30 })
    expect([inner.width, middle.width, outer.width]).toEqual([50, 70, 90])
    editor.undoAction()
    expect([inner.width, middle.width, outer.width]).toEqual([30, 50, 70])
    editor.dispose()
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

test('a layer moved into a frame with saved geometry resizes it, even before it was laid out', () => {
  const editor = createEditor()
  const { graph } = editor
  const hug = {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 4,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 2,
    paddingBottom: 2
  } as const
  // A component's layers as a .fig file loads them: saved sizes, no source format, not laid out.
  const tag = graph.createNode('COMPONENT', editor.state.currentPageId, {
    ...hug,
    width: 62,
    height: 41
  })
  const badge = graph.createNode('FRAME', tag.id, { ...hug, width: 24, height: 12 })
  graph.createNode('ELLIPSE', badge.id, { width: 8, height: 8 })
  const number = graph.createNode('RECTANGLE', tag.id, { width: 6, height: 17 })
  for (const node of [tag, badge, number]) {
    graph.applyImportedStateDuring(() =>
      graph.updateNode(node.id, {
        derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
      })
    )
  }
  editor.reorderChildWithUndo(number.id, badge.id, 1)
  expect([badge.width, badge.height]).toEqual([34, 21])
  editor.dispose()
})

test('a component read from a .fig file reflows once a layer in it is edited, but not before', () => {
  const editor = createEditor()
  const { graph } = editor
  // A component's layers as a .fig file loads them: saved sizes, but no source format.
  let button: SceneNode | undefined
  let label: SceneNode | undefined
  graph.applyImportedStateDuring(() => {
    button = graph.createNode('COMPONENT', editor.state.currentPageId, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 20,
      paddingRight: 20,
      width: 244,
      height: 40,
      derivedLayout: { x: 0, y: 0, width: 244, height: 40 }
    })
    label = graph.createNode('RECTANGLE', button.id, {
      x: 20,
      width: 204,
      height: 40,
      derivedLayout: { x: 20, y: 0, width: 204, height: 40 }
    })
  })
  if (!button || !label) throw new Error('Expected the component')
  graph.applyDerivedLayoutDuring(() => editor.runLayoutForNode(button?.id ?? ''))
  expect(button.width).toBe(244)

  editor.updateNodeWithUndo(label.id, { width: 272 })
  expect(button.width).toBe(312)
  editor.dispose()
})
