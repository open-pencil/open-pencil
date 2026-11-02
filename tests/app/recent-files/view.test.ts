import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditorStore } from '@/app/editor/session/create'
import {
  recentDocuments,
  rememberDocumentView,
  rememberedDocumentView,
  rememberRecentFile
} from '@/app/recent-files'

const PATH = '/designs/poster.fig'

let recentBefore: typeof recentDocuments.value

beforeEach(() => {
  // Recent files live in shared storage; each test starts from none and leaves them as it found them.
  recentBefore = recentDocuments.value
  recentDocuments.value = []
})

afterEach(() => {
  recentDocuments.value = recentBefore
})

/** A store showing a file on this device, as a tab opened from a path has. */
function openedFromPath(path = PATH) {
  const store = createEditorStore()
  store.setViewportSize(1920, 1080)
  store.setDocumentSource('poster.fig', 'fig', undefined, path)
  return store
}

// Figma reopens a file on the page and at the view it was left at.
describe("a document's remembered view", () => {
  test('keeps the page and the world point at the canvas centre with the recent file', async () => {
    const store = openedFromPath()
    rememberRecentFile(PATH, 'design')
    const second = store.graph.addPage('Second').id
    store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
    await store.switchPage(second)
    store.centerOn(300, 200, 2)

    rememberDocumentView(store)

    const again = openedFromPath()
    again.graph.addPage('Second')
    expect(rememberedDocumentView(again)).toBeNull()
    expect(rememberedDocumentView(store)).toEqual({
      pageId: second,
      center: { x: 300, y: 200 },
      zoom: 2
    })
  })

  test('is kept when the file is opened again and forgotten with the file', () => {
    const store = openedFromPath()
    rememberRecentFile(PATH, 'design')
    rememberDocumentView(store)
    const view = rememberedDocumentView(store)
    expect(view).not.toBeNull()

    rememberRecentFile(PATH, 'design')
    expect(rememberedDocumentView(store)).toEqual(view)

    recentDocuments.value = []
    expect(rememberedDocumentView(store)).toBeNull()
  })

  test('is ignored when stored malformed, or on a page the document hides', async () => {
    const store = openedFromPath()
    rememberRecentFile(PATH, 'design')
    const first = store.state.currentPageId
    const hidden = store.graph.addPage('Internal')
    store.graph.updateNode(hidden.id, { internalOnly: true })

    rememberDocumentView(store)
    recentDocuments.value = recentDocuments.value.map((document) => ({
      ...document,
      view: { pageId: first, zoom: 1 } as never
    }))
    expect(rememberedDocumentView(store)).toBeNull()

    store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
    await store.switchPage(hidden.id)
    rememberDocumentView(store)
    expect(recentDocuments.value[0]?.view?.pageId).toBe(hidden.id)
    expect(rememberedDocumentView(store)).toBeNull()
  })

  test('is not kept for a document recent files do not list', () => {
    const store = openedFromPath()
    rememberDocumentView(store)
    expect(recentDocuments.value).toEqual([])
    expect(rememberedDocumentView(store)).toBeNull()
  })

  test('is not kept for an unsaved document, or before the canvas has a size', () => {
    const store = createEditorStore()
    rememberRecentFile(PATH, 'design')
    rememberDocumentView(store)
    expect(recentDocuments.value[0]?.view).toBeUndefined()

    store.setViewportSize(1920, 1080)
    rememberDocumentView(store)
    expect(recentDocuments.value[0]?.view).toBeUndefined()
  })
})
