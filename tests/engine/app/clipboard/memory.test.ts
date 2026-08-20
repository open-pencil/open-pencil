import { beforeEach, describe, expect, test } from 'bun:test'

import {
  clearInMemoryClipboardHTML,
  getInMemoryClipboardHTML,
  hasInMemoryClipboardHTML,
  setInMemoryClipboardHTML
} from '@/app/editor/clipboard/memory'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import { executeClipboardCommand } from '@/app/editor/clipboard/system'
import { createEditorStore } from '@/app/editor/session/create'
import { toast } from '@/app/shell/ui'

beforeEach(() => {
  clearInMemoryClipboardHTML()
  toast.toasts.value = []
})

describe('in-memory clipboard', () => {
  test('stores, retrieves, and clears clipboard HTML', () => {
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')

    const sampleHTML = '<!--(openpencil)test-->'
    setInMemoryClipboardHTML(sampleHTML)

    expect(hasInMemoryClipboardHTML()).toBe(true)
    expect(getInMemoryClipboardHTML()).toBe(sampleHTML)

    clearInMemoryClipboardHTML()
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')
  })

  test('pasteToReplace uses in-memory clipboard when system clipboard is unavailable', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const target = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Target',
      x: 10,
      y: 10,
      width: 100,
      height: 100
    })
    store.select([target.id])

    // Copy target
    await executeClipboardCommand(store, 'copy')

    expect(hasInMemoryClipboardHTML()).toBe(true)

    // Create another node to replace
    const replaceTarget = store.graph.createNode('RECTANGLE', pageId, {
      name: 'To Replace',
      x: 50,
      y: 50,
      width: 80,
      height: 80
    })
    store.select([replaceTarget.id])

    // Run pasteClipboardToReplace
    await pasteClipboardToReplace(store)

    // Verify replace succeeded without toast errors
    expect(toast.toasts.value).toHaveLength(0)
    expect(store.graph.getNode(replaceTarget.id)).toBeUndefined()
  })

  test('executeClipboardCommand paste falls back to memory clipboard', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Source Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const copyOk = await executeClipboardCommand(store, 'copy')
    expect(copyOk).toBe(true)
    expect(hasInMemoryClipboardHTML()).toBe(true)

    const pasteOk = await executeClipboardCommand(store, 'paste')
    expect(pasteOk).toBe(true)

    // An additional node should have been pasted
    const selected = [...store.state.selectedIds]
    expect(selected).toHaveLength(1)
    expect(selected[0]).not.toBe(rect.id)
    const pastedNode = store.graph.getNode(selected[0])
    expect(pastedNode?.name).toBe('Source Rect')
  })
})
