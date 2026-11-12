import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

const VIEWPORT = { width: 800, height: 600 }

// Figma's Page Down and Page Up.
describe('page navigation', () => {
  test('moves to the next and previous page and stops at the ends', async () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    const first = editor.state.currentPageId
    const second = editor.graph.addPage('Second').id

    await editor.switchToPreviousPage()
    expect(editor.state.currentPageId).toBe(first)

    await editor.switchToNextPage()
    expect(editor.state.currentPageId).toBe(second)

    await editor.switchToNextPage()
    expect(editor.state.currentPageId).toBe(second)

    await editor.switchToPreviousPage()
    expect(editor.state.currentPageId).toBe(first)
  })
})

test('moving the last visible page places it before a trailing internal canvas', () => {
  const editor = createEditor({ getViewportSize: () => VIEWPORT })
  const [first] = editor.graph.getPages()
  if (!first) throw new Error('Expected a default page')

  const popover = editor.graph.addPage('Popover')
  const internal = editor.graph.addPage('Internal Only Canvas')
  editor.graph.updateNode(internal.id, { internalOnly: true })
  const empty = editor.graph.addPage('Empty')

  editor.movePage(empty.id, 2)

  expect(editor.graph.getPages().map((page) => page.id)).toEqual([first.id, popover.id, empty.id])
  expect(editor.graph.getPages(true).map((page) => page.id)).toEqual([
    first.id,
    popover.id,
    empty.id,
    internal.id
  ])
  const orderKeys = editor.graph.getPages(true).map((page) => page.source.orderKey)
  expect(orderKeys.every((key) => typeof key === 'string')).toBe(true)
  expect([...orderKeys].sort()).toEqual(orderKeys)
})
