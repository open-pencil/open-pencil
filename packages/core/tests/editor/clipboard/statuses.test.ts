import { afterEach, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor, type Editor } from '@open-pencil/core'
import { buildFigmaClipboardHTML } from '@open-pencil/core/clipboard'
import { initCodec } from '@open-pencil/kiwi/fig/codec'

let editor: Editor

afterEach(() => editor.dispose())

const ready = 'ready-for-dev'

function setup() {
  editor = createEditor()
  return editor.graph.createNode('FRAME', editor.state.currentPageId, {
    name: 'Checkout',
    width: 100,
    height: 100,
    status: ready
  })
}

// Figma desktop 126 drops the status on ⌘D and on copy and paste (2026-10-15).
describe('copies of a layer with a status', () => {
  test('a duplicate starts without one', () => {
    const frame = setup()
    editor.select([frame.id])
    editor.duplicateSelected()
    const copy = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
    expect(copy.id).not.toBe(frame.id)
    expect(copy.status).toBeNull()
    expect(editor.graph.getNode(frame.id)?.status).toEqual(ready)
  })

  test('a pasted copy starts without one', async () => {
    await initCodec()
    const frame = setup()
    const html = expectDefined(await buildFigmaClipboardHTML([frame], editor.graph))
    await editor.pasteFromHTML(html)
    const pasted = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
    expect(pasted.id).not.toBe(frame.id)
    expect(pasted.status).toBeNull()
  })
})
