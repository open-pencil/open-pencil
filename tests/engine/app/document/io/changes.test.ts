import { expect, test } from 'bun:test'

import { computed, effectScope } from 'vue'

import { createEditor } from '@open-pencil/core'
import { exportFigFile, parseFigFile, populateFigPage } from '@open-pencil/core/io/formats/fig'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { fontManager } from '@open-pencil/core/text'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createDocumentChanges } from '@/app/document/io/changes'

import { createTypographyActions } from '#vue/controls/typography/actions'
import { createTypographyAxes } from '#vue/controls/typography/axes'

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

/** Lets the tracker tell a change outside the history from one a step follows in its task. */
const settle = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve)
  })

type Changes = ReturnType<typeof createDocumentChanges>

/** A saved document holding one rectangle, resized once with undo before it was saved. */
async function withSavedRectangle(
  run: (editor: ReturnType<typeof createEditor>, id: string, changes: Changes) => Promise<void>
) {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const id = editor.graph.createNode('RECTANGLE', page, { width: 10 }).id
  const changes = createDocumentChanges(editor)
  try {
    editor.updateNodeWithUndo(id, { width: 20 }, 'Resize')
    await settle()
    changes.markSaved()
    await run(editor, id, changes)
  } finally {
    changes.dispose()
    editor.dispose()
  }
}

test('undoing or redoing back to the saved state saves the document again', async () => {
  await withSavedRectangle(async (editor, id, changes) => {
    const states: boolean[] = []
    const record = async () => {
      await settle()
      states.push(changes.hasUnsavedChanges())
    }
    editor.updateNodeWithUndo(id, { width: 30 }, 'Resize')
    await record()
    editor.undoAction()
    await record()
    editor.undoAction()
    await record()
    editor.redoAction()
    await record()
    expect(states).toEqual([true, false, true, false])
  })
})

test('a change outside the history keeps the document unsaved after undoing back', async () => {
  await withSavedRectangle(async (editor, id, changes) => {
    // A collaborator's change reaches the graph without a step of this tab's history.
    editor.graph.updateNode(id, { name: 'Renamed by a peer' })
    await settle()
    editor.updateNodeWithUndo(id, { width: 30 }, 'Resize')
    editor.undoAction()
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(true)
  })
})

test('changes typed while editing text belong to the step the edit records when it ends', async () => {
  await withSavedRectangle(async (editor, id, changes) => {
    // Typing resizes the layer as it goes; the text edit records one step when it is committed.
    editor.state.editingTextId = id
    editor.graph.updateNode(id, { name: 'Typing', width: 31 })
    await settle()
    editor.graph.updateNode(id, { name: 'Typing more', width: 47 })
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(true)

    editor.state.editingTextId = null
    editor.undo.push({
      label: 'Edit text',
      forward: () => editor.graph.updateNode(id, { name: 'Typing more', width: 47 }),
      inverse: () => editor.graph.updateNode(id, { name: 'Rectangle', width: 20 })
    })
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(true)

    editor.undoAction()
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(false)
  })
})

test('a save that finishes after an earlier one still returns to saved by undo', async () => {
  await withSavedRectangle(async (editor, id, changes) => {
    // An autosave starts, then a manual save starts after another edit; the autosave ends first.
    editor.updateNodeWithUndo(id, { width: 30 }, 'Resize')
    await settle()
    const autosave = changes.capture()
    editor.updateNodeWithUndo(id, { width: 40 }, 'Resize')
    await settle()
    const manualSave = changes.capture()
    changes.markSaved(autosave)
    changes.markSaved(manualSave)
    expect(changes.hasUnsavedChanges()).toBe(false)

    editor.updateNodeWithUndo(id, { width: 50 }, 'Resize')
    editor.undoAction()
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(false)
  })
})

test('an edit made after undoing past the save leaves the saved state out of reach', async () => {
  await withSavedRectangle(async (editor, id, changes) => {
    editor.undoAction()
    editor.updateNodeWithUndo(id, { width: 40 }, 'Resize')
    editor.undoAction()
    await settle()
    expect(changes.hasUnsavedChanges()).toBe(true)
  })
})

test('undoing every arrange command returns a document to saved', async () => {
  const editor = createEditor()
  const changes = createDocumentChanges(editor)
  try {
    const ids = [0, 20, 40].map(
      (x) =>
        editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
          x,
          y: x / 2,
          width: 100,
          height: 70
        }).id
    )
    changes.markSaved()
    await editor.arrangeNodes(ids, { layout: 'spread' })
    editor.tidyNodes(ids)
    editor.packNodes(ids, 'horizontal')
    await Promise.resolve()
    expect(changes.hasUnsavedChanges()).toBe(true)

    editor.undo.undo()
    editor.undo.undo()
    editor.undo.undo()
    await Promise.resolve()
    expect(changes.hasUnsavedChanges()).toBe(false)
  } finally {
    changes.dispose()
    editor.dispose()
  }
})

test('a dragged typography field undone back leaves the document saved', async () => {
  await fontManager.loadFont('Inter', 'Regular')
  const editor = createEditor()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'a',
    fontFamily: 'Inter'
  })
  const changes = createDocumentChanges(editor)
  const scope = effectScope()
  const nodes = computed(() => [editor.graph.getNode(text.id) ?? text])
  const controls = scope.run(() => ({
    actions: createTypographyActions({
      editor,
      nodes,
      activeFormatting: computed(() => []),
      supports: () => true,
      options: {}
    }),
    axes: createTypographyAxes(editor, nodes)
  }))
  if (!controls) throw new Error('Expected the typography controls')
  // Each drag step previews in a task of its own, as pointer moves do.
  const nextTask = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  try {
    changes.markSaved()
    controls.actions.updateProp('fontSize', 20)
    await nextTask()
    controls.actions.updateProp('fontSize', 24)
    await nextTask()
    controls.actions.commitProp('fontSize', 24, 14)
    controls.axes.previewAxis('wght', 500)
    await nextTask()
    controls.axes.setAxis('wght', 600)
    await nextTask()
    expect(changes.hasUnsavedChanges()).toBe(true)
    editor.undoAction()
    editor.undoAction()
    await nextTask()
    expect(changes.hasUnsavedChanges()).toBe(false)
  } finally {
    scope.stop()
    changes.dispose()
    editor.dispose()
  }
})
