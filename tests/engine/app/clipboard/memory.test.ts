import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  clearInMemoryClipboardHTML,
  getInMemoryClipboardHTML,
  hasInMemoryClipboardHTML,
  setInMemoryClipboardHTML
} from '@/app/editor/clipboard/memory'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import { executeClipboardCommand, type SystemClipboard } from '@/app/editor/clipboard/system'
import {
  createBrowserSystemClipboard,
  type BrowserClipboardIO
} from '@/app/editor/clipboard/system/browser'
import type { ClipboardPayload } from '@/app/editor/clipboard/system/types'
import { createEditorStore } from '@/app/editor/session/create'
import { toast } from '@/app/shell/ui'

beforeEach(() => {
  clearInMemoryClipboardHTML()
  toast.toasts.value = []
})

const unavailableClipboard: SystemClipboard = {
  copy: async () => false,
  paste: async () => false
}

const memoryIO: BrowserClipboardIO = {
  write: async () => true,
  readHTML: async () => ({ available: false })
}
const memoryClipboard = createBrowserSystemClipboard(memoryIO)

describe('in-memory clipboard', () => {
  test('stores, retrieves, and clears clipboard HTML', () => {
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')

    const sampleHTML = '<!--(openpencil)test-->'
    setInMemoryClipboardHTML(sampleHTML)

    expect(getInMemoryClipboardHTML('unrelated')).toBe('')
    expect(hasInMemoryClipboardHTML()).toBe(true)
    expect(getInMemoryClipboardHTML()).toBe(sampleHTML)

    clearInMemoryClipboardHTML()
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')
  })

  test('browser clipboard delegates the rich payload to its I/O boundary', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const write = mock(async (_payload: Promise<ClipboardPayload>) => true)
    const clipboard = createBrowserSystemClipboard({
      write,
      readHTML: async () => ({ available: false })
    })
    const success = await clipboard.copy(store)

    expect(success).toBe(true)
    expect(write).toHaveBeenCalledTimes(1)
    const payload = await write.mock.calls[0]?.[0]
    expect(payload?.html).toBeDefined()
    expect(payload?.plainText).toBeDefined()
    expect(hasInMemoryClipboardHTML()).toBe(true)
  })

  test('starts the writer before serialization completes', async () => {
    const store = createEditorStore()
    store.select([store.graph.createNode('RECTANGLE', store.state.currentPageId).id])
    const prepared = Promise.withResolvers<ClipboardPayload>()
    store.prepareCopy = () => prepared.promise
    let writerStarted = false
    const clipboard = createBrowserSystemClipboard({
      write: async (payload) => {
        writerStarted = true
        await payload
        return true
      },
      readHTML: async () => ({ available: false })
    })
    const copying = clipboard.copy(store)
    expect(writerStarted).toBe(true)
    prepared.resolve({ html: '<p>Prepared</p>', plainText: 'Prepared' })
    expect(await copying).toBe(true)
  })

  test('reports serialization failure without deleting or claiming success', async () => {
    const store = createEditorStore()
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId)
    store.select([node.id])
    store.prepareCopy = async () => {
      throw new Error('Encoding failed')
    }
    const clipboard = createBrowserSystemClipboard({
      write: async (payload) => {
        await payload
        return true
      },
      readHTML: async () => ({ available: false })
    })
    expect(await executeClipboardCommand(store, 'cut', undefined, clipboard)).toBe(false)
    expect(store.graph.getNode(node.id)).toBeDefined()
  })

  test('matching internal snapshots preserve geometry buffers and text sizing', async () => {
    const store = createEditorStore()
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Snapshot source',
      text: 'Hello',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: new Uint8Array([0, 1, 2, 3]) }]
    })
    store.select([node.id])
    expect(await memoryClipboard.copy(store)).toBe(true)
    expect(await memoryClipboard.paste(store)).toBe(true)
    const pasted = store.graph.getNode([...store.state.selectedIds][0])
    expect(pasted?.id).not.toBe(node.id)
    expect(pasted?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(pasted?.fillGeometry[0].commandsBlob).toBeInstanceOf(Uint8Array)
    expect(pasted?.fillGeometry[0].commandsBlob).toEqual(node.fillGeometry[0].commandsBlob)
    expect(pasted?.fillGeometry[0].commandsBlob).not.toBe(node.fillGeometry[0].commandsBlob)
  })

  test('mobile clipboard shares the typed snapshot across editor sessions', async () => {
    const source = createEditorStore()
    const node = source.graph.createNode('TEXT', source.state.currentPageId, {
      name: 'Mobile source',
      text: 'Hello',
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    source.select([node.id])
    expect(await source.mobileCopy()).toBe(true)
    const target = createEditorStore()
    await target.mobilePaste()
    const pasted = target.graph.getNode([...target.state.selectedIds][0])
    expect(pasted?.name).toBe('Mobile source')
    expect(pasted?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })

  test('does not use a stale snapshot for different valid clipboard HTML', async () => {
    const source = createEditorStore()
    const original = source.graph.createNode('TEXT', source.state.currentPageId, {
      name: 'Snapshot only',
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    source.select([original.id])
    expect(await memoryClipboard.copy(source)).toBe(true)
    const staleHTML = getInMemoryClipboardHTML()
    const external = createEditorStore()
    const rectangle = external.graph.createNode('RECTANGLE', external.state.currentPageId, {
      name: 'External'
    })
    external.select([rectangle.id])
    const differentHTML = (await external.prepareCopy()).html
    expect(differentHTML).not.toBe(staleHTML)
    const target = createEditorStore()
    await target.pasteFromHTML(differentHTML)
    expect([...target.state.selectedIds].map((id) => target.graph.getNode(id)?.name)).toEqual([
      'External'
    ])
  })

  test('failed writes clear the previous in-memory snapshot', async () => {
    const first = createEditorStore()
    const firstNode = first.graph.createNode('RECTANGLE', first.state.currentPageId, {
      name: 'Successful'
    })
    first.select([firstNode.id])
    expect(await memoryClipboard.copy(first)).toBe(true)
    expect(getInMemoryClipboardHTML()).not.toBe('')
    const second = createEditorStore()
    second.select([
      second.graph.createNode('RECTANGLE', second.state.currentPageId, { name: 'Failed' }).id
    ])
    const failing = createBrowserSystemClipboard({
      write: async (payload) => {
        await payload
        return false
      },
      readHTML: async () => ({ available: false })
    })
    expect(await failing.copy(second)).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')
  })

  test('browser clipboard returns false when its writer fails', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const clipboard = createBrowserSystemClipboard({
      write: async () => false,
      readHTML: async () => ({ available: false })
    })
    const success = await clipboard.copy(store)
    expect(success).toBe(false)
  })

  test('browser clipboard does not paste cached design data over unrelated current HTML', async () => {
    setInMemoryClipboardHTML('<!--(openpencil)cached(/openpencil)-->')
    const store = createEditorStore()
    const paste = mock(async () => undefined)
    store.pasteFromHTML = paste
    const clipboard = createBrowserSystemClipboard({
      write: async () => true,
      readHTML: async () => ({ available: true, html: '<p>ordinary current clipboard</p>' })
    })

    expect(await clipboard.paste(store)).toBe(false)
    expect(paste).not.toHaveBeenCalled()
  })

  test('browser clipboard rejects a successful plain-text-only read over stale memory', async () => {
    setInMemoryClipboardHTML('<!--(openpencil)cached(/openpencil)-->', 'cached')
    const store = createEditorStore()
    const paste = mock(async () => undefined)
    store.pasteFromHTML = paste
    const clipboard = createBrowserSystemClipboard({
      write: async () => true,
      readHTML: async () => ({ available: true, html: null })
    })

    expect(await clipboard.paste(store)).toBe(false)
    expect(paste).not.toHaveBeenCalled()
  })

  test('executeClipboardCommand cut does not delete nodes when clipboard copy fails', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Safe Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const cutOk = await executeClipboardCommand(store, 'cut', undefined, unavailableClipboard)
    expect(cutOk).toBe(false)
    expect(store.graph.getNode(rect.id)).toBeDefined()
  })

  test('executeClipboardCommand cut preserves a changed selection while copy is pending', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const first = store.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = store.graph.createNode('RECTANGLE', pageId, { name: 'Second' })
    store.select([first.id])
    const copying = Promise.withResolvers<boolean>()
    const clipboard: SystemClipboard = {
      copy: () => copying.promise,
      paste: async () => false
    }

    const cutting = executeClipboardCommand(store, 'cut', undefined, clipboard)
    store.select([second.id])
    copying.resolve(true)

    expect(await cutting).toBe(false)
    expect(store.graph.getNode(first.id)).toBeDefined()
    expect(store.graph.getNode(second.id)).toBeDefined()
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

    // Copy target (populates in-memory clipboard)
    await executeClipboardCommand(store, 'copy', undefined, memoryClipboard)

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

  test('executeClipboardCommand cut deletes selection and returns true when copy succeeds', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Cut Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const cutOk = await executeClipboardCommand(store, 'cut', undefined, memoryClipboard)
    expect(cutOk).toBe(true)
    expect(store.graph.getNode(rect.id)).toBeUndefined()
  })

  test('executeClipboardCommand paste forwards cursorPos to the matching snapshot', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Source',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])
    await executeClipboardCommand(store, 'copy', undefined, memoryClipboard)

    let receivedCursorPos: Vector | undefined
    const originalPaste = store.pasteSnapshot.bind(store)
    store.pasteSnapshot = async (snapshot, cursorPos, options) => {
      receivedCursorPos = cursorPos
      return originalPaste(snapshot, cursorPos, options)
    }

    const cursorPos: Vector = { x: 150, y: 250 }
    const pasteOk = await executeClipboardCommand(store, 'paste', cursorPos, memoryClipboard)
    expect(pasteOk).toBe(true)
    expect(receivedCursorPos).toEqual(cursorPos)
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

    await executeClipboardCommand(store, 'copy', undefined, memoryClipboard)
    expect(hasInMemoryClipboardHTML()).toBe(true)

    const pasteOk = await executeClipboardCommand(store, 'paste', undefined, memoryClipboard)
    expect(pasteOk).toBe(true)

    // An additional node should have been pasted
    const selected = [...store.state.selectedIds]
    expect(selected).toHaveLength(1)
    expect(selected[0]).not.toBe(rect.id)
    const pastedNode = store.graph.getNode(selected[0])
    expect(pastedNode?.name).toBe('Source Rect')
  })
})
