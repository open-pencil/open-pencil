import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

import { createRecoveryCover } from '@/app/document/recovery/cover'

/** A document whose first page is its cover, with a second page to edit elsewhere. */
function documentWithCover() {
  const editor = createEditor()
  const cover = editor.state.currentPageId
  const other = editor.graph.addPage('Second').id
  const card = editor.graph.createNode('FRAME', cover, { name: 'Card', width: 100, height: 50 })
  let drawn = 0
  const drawCover = createRecoveryCover(editor, () => new Uint8Array([++drawn]))
  return { editor, cover, other, card, drawCover, draws: () => drawn }
}

describe('a recovery copy cover', () => {
  test('is drawn once while the cover page stays as it was', () => {
    const { editor, other, drawCover, draws } = documentWithCover()

    expect(drawCover()).toEqual(new Uint8Array([1]))
    editor.graph.createNode('RECTANGLE', other, { name: 'Elsewhere' })
    expect(drawCover()).toEqual(new Uint8Array([1]))

    expect(draws()).toBe(1)
    editor.dispose()
  })

  test('is drawn again once the cover page changes', () => {
    const { editor, card, drawCover, draws } = documentWithCover()

    drawCover()
    editor.graph.updateNode(card.id, { width: 140 })

    expect(drawCover()).toEqual(new Uint8Array([2]))
    expect(draws()).toBe(2)
    editor.dispose()
  })

  test('is drawn again until there is one to keep', () => {
    const editor = createEditor()
    let canvas = false
    const drawCover = createRecoveryCover(editor, () => (canvas ? new Uint8Array([7]) : null))

    expect(drawCover()).toBeNull()
    canvas = true
    expect(drawCover()).toEqual(new Uint8Array([7]))
    editor.dispose()
  })
})
