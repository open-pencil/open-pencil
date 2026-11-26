import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { openDemoDocument, openTour } from '@/app/demo/document'
import { createEditorStore } from '@/app/editor/session'
import { getActiveStore, getTabsSnapshot } from '@/app/tabs'

/** The tour from Cloud, after `meanwhile` runs as a user could while it loads; null for none. */
function tourSource(meanwhile: () => void = () => undefined, found = true) {
  return async () => {
    meanwhile()
    return found ? new Uint8Array([1, 2, 3]) : null
  }
}

const savedFrames = {
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame
}

/** Animation frames that arrive at once, as a shown page draws them. */
function drawFramesAtOnce() {
  globalThis.requestAnimationFrame = (callback) => {
    queueMicrotask(() => callback(0))
    return 1
  }
  globalThis.cancelAnimationFrame = () => undefined
}

afterEach(() => {
  globalThis.requestAnimationFrame = savedFrames.request
  globalThis.cancelAnimationFrame = savedFrames.cancel
})

describe('opening the demo', () => {
  test('opens the tour from Cloud in a tab that is still blank', async () => {
    const store = createEditorStore()
    // Opening a file replaces the tab's graph, which is how the demo knows it opened.
    const open = spyOn(store, 'openFigFile').mockImplementation(async () => {
      store.replaceGraph(new SceneGraph())
    })
    drawFramesAtOnce()
    expect(await openDemoDocument(store, tourSource())).toBe(true)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]?.[0].name).toBe('Demo.fig')
  })

  test('leaves a tab alone once something was drawn while the demo loaded', async () => {
    const store = createEditorStore()
    const open = spyOn(store, 'openFigFile').mockResolvedValue(undefined)
    const drawn = tourSource(() => {
      store.graph.createNode('RECTANGLE', store.state.currentPageId, { width: 10, height: 10 })
    })
    // The caller learns the demo did not open, so a welcome offering it stays.
    expect(await openDemoDocument(store, drawn)).toBe(false)
    expect(open).not.toHaveBeenCalled()
  })

  test('fails when the server names no tour', async () => {
    const store = createEditorStore()
    await expect(openDemoDocument(store, tourSource(undefined, false))).rejects.toThrow(
      'The tour is unavailable'
    )
  })
})

describe('opening the tour', () => {
  test('closes its blank tab again when the tour fails to load', async () => {
    const documents = () => getTabsSnapshot().filter((tab) => tab.kind === 'document')
    const before = documents().map((tab) => tab.id)
    await expect(openTour(tourSource(undefined, false))).rejects.toThrow('The tour is unavailable')
    // Closing the last document shows Home, which is not a document tab.
    expect(documents().map((tab) => tab.id)).toEqual(before)
  })

  test('keeps its tab when a page was added there before the failure', async () => {
    const documents = () => getTabsSnapshot().filter((tab) => tab.kind === 'document')
    const before = documents().length
    // The page in view stays empty: only the document as a whole shows the edit.
    await expect(
      openTour(tourSource(() => getActiveStore().addPage('Notes'), false))
    ).rejects.toThrow()
    expect(documents()).toHaveLength(before + 1)
  })

  test('keeps its tab when something was drawn there before the failure', async () => {
    const documents = () => getTabsSnapshot().filter((tab) => tab.kind === 'document')
    const before = documents().length
    const drawn = tourSource(() => {
      const store = getActiveStore()
      store.graph.createNode('RECTANGLE', store.state.currentPageId, { width: 10, height: 10 })
    }, false)
    await expect(openTour(drawn)).rejects.toThrow()
    expect(documents()).toHaveLength(before + 1)
  })
})
