import type { Page } from '@playwright/test'

export async function setupCanvas(page: Page) {
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const childIds = [...(store.graph.getNode(store.state.currentPageId)?.childIds ?? [])]
    for (const id of childIds) store.graph.deleteNode(id)
    store.clearSelection()
    store.undo.clear()
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    store.requestRender()
  })
}

/** Previews the canvas draws: those of the page on screen. */
export async function previewKey(page: Page) {
  return page.evaluate(
    () =>
      window.openPencil
        ?.getStore?.()
        .canvasRenderers.flatMap((renderer) =>
          [...renderer.transientPreviews]
            .filter(([, preview]) => preview.pageId === renderer.pageId)
            .map(([key]) => key)
        )
        .join(',') ?? ''
  )
}

export function documentSnapshot(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return { nodes: [...store.snapshotPage()], undo: store.undo.canUndo }
  })
}

/** Children of `pageId`, or of the page on screen, and whether undo is available. */
export async function documentState(page: Page, pageId?: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return {
      children: store.graph.getNode(id ?? store.state.currentPageId)?.childIds ?? [],
      undo: store.undo.canUndo
    }
  }, pageId)
}

/** Add a page without switching to it; returns the page on screen and the new page. */
export async function addPage(page: Page, name: string) {
  return page.evaluate((pageName) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return { current: store.state.currentPageId, added: store.graph.addPage(pageName).id }
  }, name)
}

export async function switchPage(page: Page, pageId: string) {
  await page.evaluate(async (id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    await store.switchPage(id)
  }, pageId)
}
