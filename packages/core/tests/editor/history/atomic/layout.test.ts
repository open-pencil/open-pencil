import { describe, expect, test } from 'bun:test'

import { setup, tool, withOtherPage } from '#core-tests/helpers/atomic-tool'

import { createEditor, executeAtomicTool, type Editor } from '@open-pencil/core'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import type { ToolDef } from '@open-pencil/core/tools'

/** A real editor whose layout runner also records the layers it is asked to lay out. */
function spiedEditor() {
  const editor = createEditor()
  const figma = new FigmaAPI(editor.graph)
  const laidOut: string[] = []
  const spied: Editor = {
    ...editor,
    runLayoutForNode: (id: string) => {
      laidOut.push(id)
      editor.runLayoutForNode(id)
    }
  }
  return { editor, spied, figma, graph: editor.graph, laidOut }
}

/** A tool that runs `execute` as an atomic property edit. */
function edit(execute: () => void): ToolDef {
  return { ...tool('set_opacity'), execute }
}

describe('atomic agent tool layout', () => {
  test('an edit on another page is recorded, laid out, undone and redone in place', () => {
    const { graph, figma, editor, undo, laidOut, recorded, onRecorded } = setup()
    const { page, rect } = withOtherPage(graph)
    executeAtomicTool(
      editor,
      figma,
      tool('set_opacity'),
      { id: rect.id, value: 0.5 },
      { onRecorded }
    )
    expect(rect.opacity).toBe(0.5)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].updated.map((update) => update.id)).toEqual([rect.id])
    expect(recorded[0].pageIds).toContain(page.id)
    // Only the changed layer is laid out, not its page nor the page on screen.
    expect(laidOut).toEqual([rect.id])
    laidOut.length = 0
    undo.undo()
    expect(graph.getNode(rect.id)).toBe(rect)
    expect(rect.opacity).toBe(1)
    expect(laidOut).toEqual([rect.id])
    undo.redo()
    expect(rect.opacity).toBe(0.5)
  })

  test('an edit of a deep layer lays out the auto-layout frames around it, and so do undo and redo', () => {
    const { editor, spied, figma, graph, laidOut } = spiedEditor()
    const pageId = editor.state.currentPageId
    const hug = { layoutMode: 'HORIZONTAL', primaryAxisSizing: 'HUG' } as const
    const outer = graph.createNode('FRAME', pageId, { ...hug, width: 10, height: 40 })
    const inner = graph.createNode('FRAME', outer.id, { ...hug, width: 10, height: 40 })
    const rect = graph.createNode('RECTANGLE', inner.id, { width: 50, height: 20 })
    editor.runLayoutForNode(pageId)
    expect(outer.width).toBe(50)

    executeAtomicTool(
      spied,
      figma,
      edit(() => graph.updateNode(rect.id, { width: 150 })),
      {}
    )
    expect(inner.width).toBe(150)
    expect(outer.width).toBe(150)
    // The outermost auto-layout frame around the rectangle, not its page.
    expect(laidOut).toEqual([outer.id])
    laidOut.length = 0
    editor.undo.undo()
    expect(rect.width).toBe(50)
    expect(outer.width).toBe(50)
    expect(laidOut).toEqual([outer.id])
    editor.undo.redo()
    expect(outer.width).toBe(150)
  })

  test('changed siblings in an auto-layout row share one layout of the row', () => {
    const { editor, spied, figma, graph, laidOut } = spiedEditor()
    const pageId = editor.state.currentPageId
    const row = graph.createNode('FRAME', pageId, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      width: 1000,
      height: 40
    })
    const children = Array.from({ length: 50 }, () =>
      graph.createNode('RECTANGLE', row.id, { width: 10, height: 10 })
    )
    editor.runLayoutForNode(pageId)

    executeAtomicTool(
      spied,
      figma,
      edit(() => {
        for (const child of children) graph.updateNode(child.id, { opacity: 0.5 })
        graph.updateNode(children[0].id, { width: 30 })
      }),
      {}
    )
    expect(children[1].x).toBe(30)
    expect(laidOut).toEqual([row.id])
    laidOut.length = 0
    editor.undo.undo()
    expect(children[1].x).toBe(10)
    expect(laidOut).toEqual([row.id])
    laidOut.length = 0
    editor.undo.redo()
    expect(children[1].x).toBe(30)
    expect(laidOut).toEqual([row.id])
  })

  test('a variable change lays out every page on commit, undo and redo', () => {
    const { graph, figma, editor, undo, laidOut } = setup()
    graph.addPage('Second')
    graph.addPage('Third')
    const pages = graph.getPages().map((page) => page.id)
    const collection = graph.createCollection('Values')
    const variable = graph.createVariable('Gap', 'FLOAT', collection.id, 8)
    const args = { id: variable.id, mode: collection.defaultModeId, value: '16' }

    executeAtomicTool(editor, figma, tool('set_variable'), args)
    expect(laidOut).toEqual(pages)
    laidOut.length = 0
    undo.undo()
    expect(laidOut).toEqual(pages)
    laidOut.length = 0
    undo.redo()
    expect(laidOut).toEqual(pages)
  })

  test('a layout that writes and then throws rolls the whole edit back', () => {
    const { graph, figma, editor, undo, rectangle } = setup()
    const other = graph.createNode('RECTANGLE', figma.currentPage.id, { x: 0 })
    editor.runLayoutForNode = () => {
      graph.updateNode(other.id, { x: 99 })
      throw new Error('Layout failed')
    }
    expect(() =>
      executeAtomicTool(editor, figma, tool('set_opacity'), { id: rectangle.id, value: 0.5 })
    ).toThrow('Layout failed')
    expect(rectangle.opacity).toBe(1)
    expect(other.x).toBe(0)
    expect(undo.canUndo).toBe(false)
  })
})
