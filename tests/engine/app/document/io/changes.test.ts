import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createDocumentChanges } from '@/app/document/io/changes'

test('repainting and selection do not dirty a document; content mutations do', () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    editor.requestRender()
    editor.requestRepaint()
    editor.clearSelection()
    expect(changes.hasUnsavedChanges()).toBe(false)
    editor.createShape('RECTANGLE', 0, 0, 100, 100)
    expect(changes.hasUnsavedChanges()).toBe(true)
    changes.markSaved()
    expect(changes.hasUnsavedChanges()).toBe(false)
    editor.undo.record({
      label: 'Variable edit',
      forward: () => undefined,
      inverse: () => undefined
    })
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})

test('saving an earlier revision cannot clear edits made while exporting or picking a file', () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    editor.createShape('RECTANGLE', 0, 0, 100, 100)
    const saving = changes.capture()
    editor.createShape('ELLIPSE', 0, 0, 100, 100)
    changes.markSaved(saving)
    expect(changes.hasUnsavedChanges()).toBe(true)
    changes.markSaved()
    expect(changes.hasUnsavedChanges()).toBe(false)
    changes.markChanged()
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})

test('laying out a page does not dirty a document; an edit that relays it out does', () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    const page = editor.state.currentPageId
    const row = editor.graph.createNode('FRAME', page, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      itemSpacing: 8,
      width: 10,
      height: 10
    })
    editor.graph.createNode('RECTANGLE', row.id, { width: 40, height: 20 })
    editor.graph.createNode('RECTANGLE', row.id, { width: 40, height: 20 })
    changes.markSaved()

    computeAllLayouts(editor.graph, page)
    expect(editor.graph.getNode(row.id)?.width).toBe(88)
    expect(changes.hasUnsavedChanges()).toBe(false)

    editor.graph.updateNode(row.id, { itemSpacing: 16 })
    computeAllLayouts(editor.graph, page)
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})

test("loading a page's layers from the opened file does not dirty a document", async () => {
  await initCodec()
  const source = new SceneGraph()
  source.createNode('RECTANGLE', source.addPage('Second').id, { name: 'Loaded later' })
  const bytes = await exportFigFile(source)
  const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
  const editor = createEditor({ graph })
  const changes = createDocumentChanges(editor)
  try {
    const page = graph.getPages()[1]
    expect(populateFigPage(graph, page.id)).toBe(true)
    computeAllLayouts(graph, page.id)
    expect(graph.getChildren(page.id)).toHaveLength(1)
    expect(changes.hasUnsavedChanges()).toBe(false)

    editor.graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })
    expect(changes.hasUnsavedChanges()).toBe(true)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})
