import { describe, expect, test } from 'bun:test'

import { createEditor, isEmptyDocumentChange, type DocumentChange } from '@open-pencil/core'

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

  test('joins the newest step, or records its own with none to join', () => {
    const { editor, card } = setup()

    editor.recordEdit({ label: 'Snap', joinStep: true }, () =>
      editor.graph.updateNode(card.id, { y: 5 })
    )
    editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(card.id, { x: 37 }))
    editor.recordEdit({ label: 'Snap', joinStep: true }, () =>
      editor.graph.updateNode(card.id, { x: 40 })
    )

    expect(editor.undo.undo()).toBe('Move')
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 5 })
    expect(editor.undo.redo()).toBe('Move')
    expect(editor.graph.getNode(card.id)?.x).toBe(40)
    editor.undo.undo()
    expect(editor.undo.undo()).toBe('Snap')
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 0 })
  })

  test('rolls back an edit that threw part way and leaves no step', () => {
    const { editor, pageId, card } = setup()
    let recorded: DocumentChange | undefined

    expect(() =>
      editor.recordEdit({ label: 'Script', onRecorded: (change) => (recorded = change) }, () => {
        editor.graph.updateNode(card.id, { x: 40 })
        editor.graph.createNode('FRAME', pageId, { name: 'Half done' })
        throw new Error('failed part way')
      })
    ).toThrow('failed part way')

    expect(editor.graph.getNode(card.id)?.x).toBe(0)
    expect(editor.graph.getChildren(pageId).map((node) => node.id)).toEqual([card.id])
    expect(editor.undo.canUndo).toBe(false)
    expect(recorded && isEmptyDocumentChange(recorded)).toBe(true)
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

  test('closes the edit and rolls it back when it rejects', async () => {
    const { editor, card } = setup()
    editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(card.id, { y: 5 }))

    const edit = editor.recordEditAsync({ label: 'Agent: eval' }, async () => {
      await Promise.resolve()
      editor.graph.updateNode(card.id, { x: 40 })
      throw new Error('script failed')
    })

    await expect(edit).rejects.toThrow('script failed')
    expect(editor.undo.isRecording).toBe(false)
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 5 })
    expect(editor.undo.undo()).toBe('Move')
  })

  test('does not record a step for an edit that records its own', async () => {
    const { editor, card } = setup()

    await editor.recordEditAsync({ label: 'Agent', push: false }, async () => {
      await Promise.resolve()
      editor.graph.updateNode(card.id, { x: 40 })
    })

    expect(editor.undo.canUndo).toBe(false)
  })

  test('leaves what changes while it waits outside itself out of its step', async () => {
    const { editor, pageId, card } = setup()
    const other = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const { id: collectionId } = editor.graph.createCollection('Tokens')
    const gap = editor.graph.createVariable('gap', 'FLOAT', collectionId, 4)
    const download = Promise.withResolvers<undefined>()

    const edit = editor.recordEditAsync({ label: 'Agent: photo' }, async () => {
      editor.graph.updateNode(card.id, { width: 120 })
      await editor.graph.waitOutsideEdit(download.promise)
      editor.graph.updateNode(card.id, { x: 40 })
      editor.graph.updateNode(other.id, { y: 5 })
    })
    editor.recordEdit({ label: 'Move' }, () => {
      editor.graph.updateNode(other.id, { x: 25 })
      editor.graph.updateNode(card.id, { y: 8 })
      editor.graph.willChangeVariable(gap.id)
      const variable = editor.graph.variables.get(gap.id)
      if (variable) variable.name = 'spacing'
    })
    download.resolve(undefined)
    await edit

    expect(editor.undo.undo()).toBe('Agent: photo')
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, y: 8, width: 100 })
    expect(editor.graph.getNode(other.id)).toMatchObject({ x: 25, y: 0 })
    expect(editor.graph.variables.get(gap.id)?.name).toBe('spacing')
    expect(editor.undo.undo()).toBe('Move')
    expect(editor.graph.getNode(other.id)?.x).toBe(0)
  })

  test('keeps what changes meanwhile in a record or layer it also changed', async () => {
    const { editor, pageId, card } = setup()
    const { id: collectionId } = editor.graph.createCollection('Tokens')
    const gap = editor.graph.createVariable('gap', 'FLOAT', collectionId, 4)
    const width = editor.graph.createVariable('width', 'FLOAT', collectionId, 100)
    const height = editor.graph.createVariable('height', 'FLOAT', collectionId, 50)
    const doomed = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const download = Promise.withResolvers<undefined>()

    const edit = editor.recordEditAsync({ label: 'Agent: tokens' }, async () => {
      editor.graph.willChangeVariable(gap.id)
      const variable = editor.graph.variables.get(gap.id)
      if (variable) variable.name = 'spacing'
      editor.graph.bindVariable(card.id, 'width', width.id)
      editor.graph.updateNode(doomed.id, { x: 5 })
      await editor.graph.waitOutsideEdit(download.promise)
    })
    editor.recordEdit({ label: 'User' }, () => {
      editor.graph.willChangeVariable(gap.id)
      const variable = editor.graph.variables.get(gap.id)
      if (variable) variable.valuesByMode = { ...variable.valuesByMode, extra: 8 }
      editor.graph.bindVariable(card.id, 'height', height.id)
      editor.graph.deleteNode(doomed.id)
    })
    download.resolve(undefined)
    await edit

    expect(editor.undo.undo()).toBe('Agent: tokens')
    expect(editor.graph.variables.get(gap.id)).toMatchObject({
      name: 'gap',
      valuesByMode: expect.objectContaining({ extra: 8 })
    })
    expect(editor.graph.getNode(card.id)?.boundVariables).toEqual({ height: height.id })
    expect(editor.graph.getNode(doomed.id)).toBeUndefined()
  })

  test('waits outside itself while an earlier edit’s wait is still pending', async () => {
    const { editor, pageId, card } = setup()
    const other = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const leftover = Promise.withResolvers<undefined>()
    const download = Promise.withResolvers<undefined>()
    // A script leaves a load unawaited; it is still pending when the next edit waits.
    await editor.recordEditAsync({ label: 'Agent: first' }, async () => {
      void editor.graph.waitOutsideEdit(leftover.promise)
    })

    const edit = editor.recordEditAsync({ label: 'Agent: second' }, async () => {
      editor.graph.updateNode(card.id, { x: 40 })
      await editor.graph.waitOutsideEdit(download.promise)
    })
    editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(other.id, { x: 25 }))
    leftover.resolve(undefined)
    download.resolve(undefined)
    await edit

    expect(editor.undo.undo()).toBe('Agent: second')
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
    expect(editor.graph.getNode(other.id)?.x).toBe(25)
  })

  test('keeps an undo made while it waits out of its step', async () => {
    const { editor, card } = setup()
    const { id: collectionId } = editor.graph.createCollection('Tokens')
    const gap = editor.graph.createVariable('gap', 'FLOAT', collectionId, 4)
    editor.recordEdit({ label: 'Rename' }, () => {
      editor.graph.willChangeVariable(gap.id)
      const variable = editor.graph.variables.get(gap.id)
      if (variable) variable.name = 'spacing'
    })
    const download = Promise.withResolvers<undefined>()

    const edit = editor.recordEditAsync({ label: 'Agent: value' }, async () => {
      editor.graph.willChangeVariable(gap.id)
      const variable = editor.graph.variables.get(gap.id)
      if (variable) variable.valuesByMode = { ...variable.valuesByMode, extra: 8 }
      editor.graph.updateNode(card.id, { x: 40 })
      await editor.graph.waitOutsideEdit(download.promise)
    })
    expect(editor.undo.undo()).toBe('Rename')
    download.resolve(undefined)
    await edit

    expect(editor.undo.undo()).toBe('Agent: value')
    expect(editor.graph.variables.get(gap.id)?.name).toBe('gap')
    expect(editor.graph.variables.get(gap.id)?.valuesByMode).not.toHaveProperty('extra')
  })

  // Known gap: nothing tells whose write is whose across an await, so the open edit takes in an
  // edit the user makes meanwhile. A collaborator's and an undo stay out (`runOutsideEdits`).
  test.failing('leaves an edit made elsewhere while it awaits out of its step', async () => {
    const { editor, pageId, card } = setup()
    const other = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })

    await editor.recordEditAsync({ label: 'Agent: arrange' }, async () => {
      await Promise.resolve()
      editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(other.id, { x: 25 }))
      editor.graph.updateNode(card.id, { x: 40 })
    })

    expect(editor.undo.undo()).toBe('Agent: arrange')
    expect(editor.graph.getNode(card.id)?.x).toBe(0)
    expect(editor.graph.getNode(other.id)?.x).toBe(25)
  })

  test('keeps an undo made while it awaits out of its step', async () => {
    const { editor, card } = setup()
    editor.recordEdit({ label: 'Move' }, () => editor.graph.updateNode(card.id, { x: 25 }))

    await editor.recordEditAsync({ label: 'Agent: resize' }, async () => {
      await Promise.resolve()
      editor.undo.undo()
      editor.graph.updateNode(card.id, { width: 200 })
    })

    expect(editor.undo.undo()).toBe('Agent: resize')
    expect(editor.graph.getNode(card.id)).toMatchObject({ x: 0, width: 100 })
  })

  test('undoing it keeps a layer someone else put into a frame it created', async () => {
    const { editor, pageId } = setup()
    const download = Promise.withResolvers<undefined>()
    let frameId = ''

    const edit = editor.recordEditAsync({ label: 'Agent: frame' }, async () => {
      const frame = editor.graph.createNode('FRAME', pageId, {
        x: 100,
        y: 50,
        width: 200,
        height: 200
      })
      frameId = frame.id
      await editor.graph.waitOutsideEdit(download.promise)
    })
    const note = editor.recordEdit({ label: 'Add note' }, () =>
      editor.graph.createNode('RECTANGLE', frameId, { x: 10, y: 20, width: 5, height: 5 })
    )
    download.resolve(undefined)
    await edit

    expect(editor.undo.undo()).toBe('Agent: frame')
    expect(editor.graph.getNode(frameId)).toBeUndefined()
    // The note moves out to the page and stays where it was on the canvas.
    expect(editor.graph.getNode(note.id)).toMatchObject({ parentId: pageId, x: 110, y: 70 })
    expect(editor.undo.undo()).toBe('Add note')
    expect(editor.graph.getNode(note.id)).toBeUndefined()
  })

  test('undoing it brings back the mode a collection it removed was showing', () => {
    const { editor } = setup()
    const collection = editor.graph.createCollection('Theme')
    const dark = editor.graph.createMode(collection.id, 'Dark')
    if (!dark) throw new Error('No Dark mode')
    editor.graph.setActiveMode(collection.id, dark)

    editor.recordEdit({ label: 'Agent: remove' }, () =>
      editor.graph.removeCollection(collection.id)
    )
    expect(editor.undo.undo()).toBe('Agent: remove')
    expect(editor.graph.activeMode.get(collection.id)).toBe(dark)

    editor.undo.redo()
    expect(editor.graph.activeMode.has(collection.id)).toBe(false)
  })
})
