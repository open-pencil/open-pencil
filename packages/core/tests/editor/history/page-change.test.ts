import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor, graphFromPageChange, isEmptyPageChange } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card', width: 200, height: 120 })
  const title = editor.graph.createNode('TEXT', card.id, { name: 'Title', text: 'Hello' })
  const badge = editor.graph.createNode('RECTANGLE', card.id, { name: 'Badge', width: 24 })
  const other = editor.graph.createNode('FRAME', pageId, { name: 'Other', x: 400 })
  return { editor, pageId, card, title, badge, other }
}

/** Records an edit, then checks that undo and redo bring back each side exactly. */
function roundTrip(editor: ReturnType<typeof setup>['editor'], edit: () => void) {
  const pageId = editor.state.currentPageId
  const before = editor.snapshotPage(pageId)
  const finish = editor.capturePageChange(pageId)
  edit()
  const change = finish()
  const after = editor.snapshotPage(pageId)

  editor.restorePageChange(change, 'before')
  expect(editor.snapshotPage(pageId)).toEqual(before)
  editor.restorePageChange(change, 'after')
  expect(editor.snapshotPage(pageId)).toEqual(after)
  return change
}

describe('page changes', () => {
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
    const finish = editor.capturePageChange(pageId)
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
    editor.restorePageChange(change, 'before')
    expect(editor.graph.getNode(badge.id)).toBe(expectDefined(untouched, 'badge'))
    expect(editor.graph.getNode(title.id)).toBe(expectDefined(edited, 'title'))
    expect(editor.graph.getNode(card.id)?.childIds).toEqual([title.id, badge.id])
  })

  test('an edit that changes nothing is empty', () => {
    const { editor, pageId } = setup()
    const finish = editor.capturePageChange(pageId)
    expect(isEmptyPageChange(finish())).toBe(true)
  })

  test('builds standalone graphs of both sides of an edit', () => {
    const { editor, pageId, title, badge } = setup()
    const finish = editor.capturePageChange(pageId)
    editor.graph.updateNode(title.id, { text: 'Changed' })
    editor.graph.deleteNode(badge.id)
    const change = finish()

    const before = expectDefined(graphFromPageChange(editor.graph, change, 'before'), 'before')
    const after = expectDefined(graphFromPageChange(editor.graph, change, 'after'), 'after')
    expect(before.getNode(title.id)?.text).toBe('Hello')
    expect(before.getNode(badge.id)?.name).toBe('Badge')
    expect(after.getNode(title.id)?.text).toBe('Changed')
    expect(after.getNode(badge.id)).toBeUndefined()
    // Building the past side leaves the document alone.
    expect(editor.graph.getNode(title.id)?.text).toBe('Changed')
    expect(editor.graph.getNode(badge.id)).toBeUndefined()
  })
})
