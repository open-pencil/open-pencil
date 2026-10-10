import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor, graphFromDocumentChange, isEmptyDocumentChange } from '@open-pencil/core/editor'
import { readComments, writeComments, type CommentThread } from '@open-pencil/scene-graph'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 120 })
  const title = editor.graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello' })
  const badge = editor.graph.createNode('RECTANGLE', card.id, { name: 'Badge', width: 24 })
  const other = editor.graph.createNode('FRAME', pageId, { name: 'Other', x: 400 })
  return { editor, pageId, card, title, badge, other }
}

type Editor = ReturnType<typeof setup>['editor']

/** Every page, the document node, and the variables, as copies. */
function documentState(editor: Editor) {
  const { graph } = editor
  return {
    root: structuredClone(graph.getNode(graph.rootId)),
    pages: graph.getPages().map((page) => editor.snapshotPage(page.id)),
    variables: structuredClone(graph.variables),
    collections: structuredClone(graph.variableCollections)
  }
}

/** Records an edit, then checks that undo and redo bring back each side exactly. */
function roundTrip(editor: Editor, edit: () => void) {
  const before = documentState(editor)
  const finish = editor.captureDocumentChange(editor.state.currentPageId)
  edit()
  const change = finish()
  const after = documentState(editor)

  editor.restoreDocumentChange(change, 'before')
  expect(documentState(editor)).toEqual(before)
  editor.restoreDocumentChange(change, 'after')
  expect(documentState(editor)).toEqual(after)
  return change
}

function thread(id: string, pageId: string): CommentThread {
  return {
    id,
    pageId,
    x: 0,
    y: 0,
    author: 'Ada',
    text: id,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    resolved: false,
    replies: []
  }
}

describe('document changes', () => {
  test('undo and redo restore created, edited, and deleted layers', () => {
    const { editor, card, title, badge } = setup()
    roundTrip(editor, () => {
      editor.graph.updateNode(title.id, { text: 'Changed', x: 12 })
      editor.graph.deleteNode(badge.id)
      const added = editor.graph.createNode('FRAME', card.id, { name: 'Added' })
      editor.graph.createNode('TEXT', added.id, { name: 'Inner', text: 'New' })
    })
  })

  test('undo and redo restore moves, including nesting two layers the other way round', () => {
    const { editor, pageId, card, title, other } = setup()
    roundTrip(editor, () => {
      editor.graph.insertChildAt(title.id, other.id, 0)
      editor.graph.reorderChild(other.id, pageId, 0)
    })
    roundTrip(editor, () => {
      editor.graph.reparentNode(other.id, card.id)
    })
    roundTrip(editor, () => {
      editor.graph.reparentNode(card.id, pageId)
      editor.graph.reparentNode(other.id, pageId)
      editor.graph.reparentNode(card.id, other.id)
    })
  })

  test('layers that survive a removed parent are moved back out first', () => {
    const { editor, pageId, card, other } = setup()
    roundTrip(editor, () => {
      const wrapper = editor.graph.createNode('FRAME', pageId, { name: 'Wrapper' })
      editor.graph.reparentNode(card.id, wrapper.id)
      editor.graph.reparentNode(other.id, wrapper.id)
    })
  })

  test('keeps copies of only the layers the edit touched', () => {
    const { editor, pageId, card, title, badge, other } = setup()
    const finish = editor.captureDocumentChange(pageId)
    editor.graph.updateNode(title.id, { text: 'Changed' })
    editor.graph.createNode('RECTANGLE', other.id, { name: 'New' })
    const change = finish()

    expect(change.updated.map((update) => update.id)).toEqual([title.id])
    expect(change.updated[0]?.fields?.after).toEqual({ text: 'Changed' })
    // Marking the field edited keeps that list, not the layer's whole source metadata.
    expect(change.updated[0]?.source?.after).toEqual({ editedFields: ['text'] })
    expect(change.updated[0]?.fig).toBeNull()
    expect(change.created.map((node) => node.name)).toEqual(['New'])
    expect(change.children.after.map((list) => list.id)).toEqual([other.id])

    // Undo edits the layers in place, leaving untouched ones as they are.
    const untouched = editor.graph.getNode(badge.id)
    const edited = editor.graph.getNode(title.id)
    editor.restoreDocumentChange(change, 'before')
    expect(editor.graph.getNode(badge.id)).toBe(expectDefined(untouched, 'badge'))
    expect(editor.graph.getNode(title.id)).toBe(expectDefined(edited, 'title'))
    expect(editor.graph.getNode(card.id)?.childIds).toEqual([title.id, badge.id])
  })

  test('an edit that changes nothing is empty', () => {
    const { editor, pageId } = setup()
    const finish = editor.captureDocumentChange(pageId)
    expect(isEmptyDocumentChange(finish())).toBe(true)
  })

  test('builds standalone graphs of both sides of an edit', () => {
    const { editor, pageId, title, badge } = setup()
    const finish = editor.captureDocumentChange(pageId)
    editor.graph.updateNode(title.id, { text: 'Changed' })
    editor.graph.deleteNode(badge.id)
    const change = finish()

    const before = expectDefined(graphFromDocumentChange(editor.graph, change, 'before'), 'before')
    const after = expectDefined(graphFromDocumentChange(editor.graph, change, 'after'), 'after')
    expect(before.getNode(title.id)?.text).toBe('Hello')
    expect(before.getNode(badge.id)?.name).toBe('Badge')
    expect(after.getNode(title.id)?.text).toBe('Changed')
    expect(after.getNode(badge.id)).toBeUndefined()
    // Building the past side leaves the document alone.
    expect(editor.graph.getNode(title.id)?.text).toBe('Changed')
    expect(editor.graph.getNode(badge.id)).toBeUndefined()
  })

  test('undo and redo restore layers on other pages', () => {
    const { editor } = setup()
    const second = editor.graph.addPage('Second')
    const card = editor.graph.createNode('FRAME', second.id, { name: 'Card' })
    const label = editor.graph.createNode('TEXT', card.id, { name: 'Label', text: 'Hi' })
    const change = roundTrip(editor, () => {
      editor.graph.updateNode(label.id, { text: 'Changed' })
      editor.graph.createNode('RECTANGLE', card.id, { name: 'Added' })
    })
    expect(change.pageIds).toEqual([second.id])
  })

  test('undo and redo restore a layer moved to another page', () => {
    const { editor, card } = setup()
    const second = editor.graph.addPage('Second')
    roundTrip(editor, () => editor.graph.reparentNode(card.id, second.id))
  })

  test('undo and redo restore added, renamed, moved, and removed pages', () => {
    const { editor, pageId } = setup()
    const second = editor.graph.addPage('Second')
    editor.graph.createNode('FRAME', second.id, { name: 'On second' })
    roundTrip(editor, () => {
      editor.graph.addPage('Added')
      editor.graph.updateNode(pageId, { name: 'Renamed' })
      editor.graph.insertChildAt(pageId, editor.graph.rootId, 1)
    })
    roundTrip(editor, () => editor.graph.deleteNode(second.id))
  })

  test('undo and redo restore variables, collections, and bindings', () => {
    const { editor, title } = setup()
    const collection = editor.graph.createCollection('Colors')
    const brand = editor.graph.createVariable('Brand', 'COLOR', collection.id, {
      r: 1,
      g: 0,
      b: 0,
      a: 1
    })
    roundTrip(editor, () => {
      const faded = editor.graph.createVariable('Faded', 'FLOAT', collection.id, 0.5)
      brand.name = 'Primary'
      editor.graph.bindVariable(title.id, 'opacity', faded.id)
    })
    roundTrip(editor, () => editor.graph.removeVariable(brand.id))
    roundTrip(editor, () => editor.graph.removeCollection(collection.id))
  })

  test('a layer created and then edited is undone as created', () => {
    const { editor, pageId } = setup()
    const second = editor.graph.addPage('Second')
    const change = roundTrip(editor, () => {
      const added = editor.graph.createNode('FRAME', second.id, { name: 'New' })
      editor.graph.updateNode(added.id, { name: 'Renamed' })
      editor.graph.reparentNode(added.id, pageId)
    })
    expect(change.created.map((node) => node.name)).toEqual(['Renamed'])
    expect(change.updated).toEqual([])
  })

  test('comments are never part of a change, and undo leaves them as they are', () => {
    const { editor, pageId } = setup()
    const { graph } = editor
    const finishComment = editor.captureDocumentChange(pageId)
    writeComments(graph, [thread('first', pageId)])
    expect(isEmptyDocumentChange(finishComment())).toBe(true)

    // A step that renames the document and comments as it goes.
    const finish = editor.captureDocumentChange(pageId)
    graph.updateNode(graph.rootId, { name: 'Renamed' })
    writeComments(graph, [thread('first', pageId), thread('second', pageId)])
    const change = finish()
    // Someone comments after the step.
    writeComments(graph, [thread('first', pageId), thread('second', pageId), thread('third', pageId)])

    editor.restoreDocumentChange(change, 'before')
    expect(graph.getNode(graph.rootId)?.name).toBe('Document')
    expect(readComments(graph).map((entry) => entry.id)).toEqual(['first', 'second', 'third'])
    editor.restoreDocumentChange(change, 'after')
    expect(graph.getNode(graph.rootId)?.name).toBe('Renamed')
    expect(readComments(graph)).toHaveLength(3)
  })
})
