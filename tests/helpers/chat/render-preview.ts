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

export async function previewKey(page: Page) {
  return page.evaluate(
    () =>
      window.openPencil
        ?.getStore?.()
        .canvasRenderers.flatMap((renderer) => [...renderer.transientPreviews.keys()])
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

export async function documentState(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return {
      children: store.graph.getNode(store.state.currentPageId)?.childIds ?? [],
      undo: store.undo.canUndo
    }
  })
}
