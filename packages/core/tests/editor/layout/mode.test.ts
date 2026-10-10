import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import { expectDefined } from '#core-tests/helpers/assert'

function scene() {
  const editor = createEditor()
  const outer = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    x: 100,
    y: 100,
    width: 500,
    height: 300,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 24,
    paddingTop: 20,
    paddingRight: 20,
    paddingBottom: 20,
    paddingLeft: 20
  })
  const frame = editor.graph.createNode('FRAME', outer.id, { width: 260, height: 180 })
  const first = editor.graph.createNode('RECTANGLE', frame.id, {
    x: 20,
    y: 35,
    width: 90,
    height: 40
  })
  const second = editor.graph.createNode('FRAME', frame.id, {
    x: 145,
    y: 95,
    width: 80,
    height: 55,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    paddingLeft: 10,
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 10,
    layoutAlignSelf: 'STRETCH'
  })
  editor.graph.createNode('RECTANGLE', second.id, {
    width: 60,
    height: 20,
    layoutGrow: 1
  })
  const sibling = editor.graph.createNode('RECTANGLE', outer.id, { width: 100, height: 70 })
  editor.runLayoutForNode(outer.id)
  editor.select([frame.id])
  return { editor, outer, frame, first, second, sibling }
}

function layoutState(editor: Editor) {
  return [...editor.graph.nodes.values()].map((node) => ({
    id: node.id,
    parentId: node.parentId,
    childIds: [...node.childIds],
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    layoutMode: node.layoutMode,
    primaryAxisSizing: node.primaryAxisSizing,
    counterAxisSizing: node.counterAxisSizing,
    itemSpacing: node.itemSpacing,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    gridTemplateColumns: structuredClone(node.gridTemplateColumns),
    gridTemplateRows: structuredClone(node.gridTemplateRows)
  }))
}

describe('layout mode history', () => {
  for (const mode of ['VERTICAL', 'HORIZONTAL', 'GRID'] as const) {
    test(`undo adding ${mode} restores children, descendants, and surrounding Hug layout exactly`, () => {
      const { editor, frame, first } = scene()
      try {
        const before = layoutState(editor)
        editor.setLayoutMode(frame.id, mode)
        const after = layoutState(editor)
        expect(after).not.toEqual(before)
        expect(first.y).not.toBe(35)
        for (let cycle = 0; cycle < 2; cycle++) {
          editor.undoAction()
          expect(layoutState(editor)).toEqual(before)
          expect(editor.undo.canUndo).toBe(false)
          editor.redoAction()
          expect(layoutState(editor)).toEqual(after)
        }
      } finally {
        editor.dispose()
      }
    })
  }

  test('switching direction and removing layout each restore the previous geometry in one undo step', () => {
    const { editor, frame } = scene()
    try {
      editor.setLayoutMode(frame.id, 'VERTICAL')
      const vertical = layoutState(editor)
      editor.setLayoutMode(frame.id, 'HORIZONTAL')
      const horizontal = layoutState(editor)
      editor.setLayoutMode(frame.id, 'NONE')
      editor.undoAction()
      expect(layoutState(editor)).toEqual(horizontal)
      editor.undoAction()
      expect(layoutState(editor)).toEqual(vertical)
    } finally {
      editor.dispose()
    }
  })

  test('setting the existing layout mode leaves undo history untouched', () => {
    const { editor, frame } = scene()
    try {
      editor.setLayoutMode(frame.id, 'NONE')
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })
})

test('undo wrapping a nested selection restores parent order and all affected geometry', () => {
  const { editor, frame, first, second } = scene()
  try {
    editor.select([second.id, first.id])
    const before = layoutState(editor)
    editor.wrapInAutoLayout()
    const after = layoutState(editor)
    for (let cycle = 0; cycle < 2; cycle++) {
      editor.undoAction()
      expect(layoutState(editor)).toEqual(before)
      expect(editor.state.selectedIds).toEqual(new Set([second.id, first.id]))
      expect(frame.childIds).toEqual([first.id, second.id])
      expect(editor.undo.canUndo).toBe(false)
      editor.redoAction()
      expect(layoutState(editor)).toEqual(after)
    }
  } finally {
    editor.dispose()
  }
})

// Figma places a new container in the slot of the topmost selected layer.
test('the wrapper takes the slot of the topmost selected layer', () => {
  const editor = createEditor()
  try {
    const parent = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      width: 600,
      height: 200
    })
    const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((name, index) =>
      editor.graph.createNode('RECTANGLE', parent.id, {
        name,
        x: 20 + index * 140,
        y: 40,
        width: 80,
        height: 60
      })
    )
    editor.select([d.id, b.id])
    const frameId = editor.wrapInAutoLayout()
    expect(parent.childIds).toEqual([a.id, c.id, expectDefined(frameId, 'wrapper')])
    editor.undoAction()
    expect(parent.childIds).toEqual([a.id, b.id, c.id, d.id])
  } finally {
    editor.dispose()
  }
})
