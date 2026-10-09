import { describe, expect, mock, test } from 'bun:test'

import { createBrowserSystemClipboard } from '@/app/editor/clipboard/system/browser'
import { createEditorStore } from '@/app/editor/session/create'

const SVG = '<svg viewBox="0 0 10 10"><rect id="square" width="10" height="10"/></svg>'

describe('browser clipboard paste', () => {
  test('pastes SVG markup copied as text as layers at the cursor', async () => {
    const store = createEditorStore()
    const clipboard = createBrowserSystemClipboard({
      write: async () => true,
      read: async () => ({ available: true, html: null, text: SVG })
    })

    expect(await clipboard.paste(store, { x: 50, y: 50 })).toBe(true)

    const [frame] = store.graph.getChildren(store.state.currentPageId)
    expect(frame).toMatchObject({ type: 'FRAME', x: 45, y: 45 })
    expect(store.graph.getChildren(frame?.id ?? '').map((node) => node.name)).toEqual(['square'])
  })

  test('prefers copied OpenPencil layers over SVG text', async () => {
    const store = createEditorStore()
    const paste = mock(async () => undefined)
    store.pasteFromHTML = paste
    const clipboard = createBrowserSystemClipboard({
      write: async () => true,
      read: async () => ({
        available: true,
        html: '<!--(openpencil)layers(/openpencil)-->',
        text: SVG
      })
    })

    expect(await clipboard.paste(store)).toBe(true)
    expect(paste).toHaveBeenCalledTimes(1)
    expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(0)
  })
})
