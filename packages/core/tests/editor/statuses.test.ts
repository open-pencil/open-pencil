import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { STATUS_WORKFLOW_PRESETS, writeStatusWorkflow } from '@open-pencil/scene-graph/statuses'

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  editor = createEditor()
  const { graph } = editor
  writeStatusWorkflow(graph, STATUS_WORKFLOW_PRESETS.review)
  const section = graph.createNode('SECTION', editor.state.currentPageId, {
    name: 'Checkout',
    status: 'approved'
  })
  const card = graph.createNode('FRAME', section.id, { name: 'Card' })
  return { section, card }
}

const statusOf = (id: string) => editor.graph.getNode(id)?.status

describe('statuses in the editor', () => {
  test('sets a status on every layer that can show one, as one undo step', () => {
    const { section, card } = setup()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, { name: 'Other' })
    expect(editor.setStatus([section.id, card.id, frame.id], 'in-review')).toBe(2)
    expect(statusOf(card.id)).toBeNull()
    expect(statusOf(frame.id)).toBe('in-review')
    expect(editor.getShownStatus(section.id)?.name).toBe('In review')
    editor.undo.undo()
    expect(statusOf(section.id)).toBe('approved')
    expect(statusOf(frame.id)).toBeNull()
    editor.undo.redo()
    expect(statusOf(section.id)).toBe('in-review')
    expect(statusOf(frame.id)).toBe('in-review')
  })

  test('clears statuses, undoably', () => {
    const { section } = setup()
    editor.setStatus([section.id], null)
    expect(statusOf(section.id)).toBeNull()
    editor.undo.undo()
    expect(statusOf(section.id)).toBe('approved')
  })

  test('a workflow edit moves layers off a dropped state and undoes as one step', () => {
    const { section } = setup()
    const states = STATUS_WORKFLOW_PRESETS.review.states.filter((state) => state.id !== 'approved')
    editor.setStatusWorkflow({ states }, { approved: 'ready-for-dev' })
    expect(editor.statusWorkflow().states.map((state) => state.id)).not.toContain('approved')
    expect(statusOf(section.id)).toBe('ready-for-dev')
    editor.undo.undo()
    expect(editor.statusWorkflow().preset).toBe('review')
    expect(statusOf(section.id)).toBe('approved')
    editor.undo.redo()
    expect(statusOf(section.id)).toBe('ready-for-dev')
  })
})
