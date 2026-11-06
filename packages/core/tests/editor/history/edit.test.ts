import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const card = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 100, height: 50 })
  return { editor, pageId, card }
}

describe('recordEdit', () => {
  test('records a synchronous edit as one step', () => {
    const { editor, card } = setup()

    editor.recordEdit({ label: 'Move' }, () => {
      editor.graph.updateNode(card.id, { x: 40 })
      editor.graph.updateNode(card.id, { y: 10 })
    })

    expect(editor.undo.undo()).toBe('Move')
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 0 })
    expect(editor.undo.canUndo).toBe(false)
  })

  test('joins a batch open around it, unless it records its own step', () => {
    const { editor, card } = setup()

    editor.undo.beginBatch('Drag')
    editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(card.id, { x: 40 }))
    editor.undo.rollbackBatch()
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
    expect(editor.undo.canUndo).toBe(false)

    editor.undo.beginBatch('Drag')
    editor.recordEdit({ label: 'Arrange', ownStep: true }, () =>
      editor.graph.updateNode(card.id, { x: 60 })
    )
    editor.undo.rollbackBatch()
    expect(editor.graph.getNode(card.id)?.x).toBe(60)
    expect(editor.undo.undo()).toBe('Arrange')
  })

  test('records what an edit did before it threw', () => {
    const { editor, card } = setup()

    expect(() =>
      editor.recordEdit({ label: 'Script' }, () => {
        editor.graph.updateNode(card.id, { x: 40 })
        throw new Error('failed part way')
      })
    ).toThrow('failed part way')

    expect(editor.undo.undo()).toBe('Script')
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
  })

  test('leaves no step for an edit that changed nothing, and still reports it', () => {
    const { editor } = setup()
    let reported = false

    editor.recordEdit({ label: 'Read', onRecorded: () => (reported = true) }, () => undefined)

    expect(reported).toBe(true)
    expect(editor.undo.canUndo).toBe(false)
  })
})

describe('recordEditAsync', () => {
  test('keeps the edit open across awaits and records one step when it ends', async () => {
    const { editor, card } = setup()
    const open: boolean[] = []

    await editor.recordEditAsync({ label: 'Agent: arrange' }, async () => {
      open.push(editor.undo.isRecording)
      await Promise.resolve()
      editor.graph.updateNode(card.id, { x: 40 })
      await Promise.resolve()
      open.push(editor.undo.isRecording)
    })

    expect(open).toEqual([true, true])
    expect(editor.undo.isRecording).toBe(false)
    expect(editor.undo.undo()).toBe('Agent: arrange')
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
  })

  test('closes the edit and keeps its changes undoable when it rejects', async () => {
    const { editor, card } = setup()

    const edit = editor.recordEditAsync({ label: 'Agent: eval' }, async () => {
      await Promise.resolve()
      editor.graph.updateNode(card.id, { x: 40 })
      throw new Error('script failed')
    })

    await expect(edit).rejects.toThrow('script failed')
    expect(editor.undo.isRecording).toBe(false)
    expect(editor.undo.undo()).toBe('Agent: eval')
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
  })

  test('does not record a step for an edit that records its own', async () => {
    const { editor, card } = setup()

    await editor.recordEditAsync({ label: 'Agent', push: false }, async () => {
      await Promise.resolve()
      editor.graph.updateNode(card.id, { x: 40 })
    })

    expect(editor.undo.canUndo).toBe(false)
  })
})
