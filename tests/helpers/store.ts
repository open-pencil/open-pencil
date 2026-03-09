import type { Page } from '@playwright/test'

export function getSelectedIds(page: Page) {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
}

export function getPageChildren(page: Page) {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n: any) => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      layoutMode: n.layoutMode,
      childIds: n.childIds,
      vectorNetwork: n.vectorNetwork,
    }))
  })
}

export function getSelectedNode(page: Page) {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation,
      layoutMode: n.layoutMode,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      itemSpacing: n.itemSpacing,
      childIds: n.childIds,
      cornerRadius: n.cornerRadius,
      flipX: n.flipX,
      clipsContent: n.clipsContent,
      fills: n.fills,
      fontWeight: n.fontWeight,
      italic: n.italic,
    }
  })
}

export function getNodeById(page: Page, id: string) {
  return page.evaluate((nodeId: string) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return {
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation,
      layoutMode: n.layoutMode,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      itemSpacing: n.itemSpacing,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      childIds: n.childIds,
      cornerRadius: n.cornerRadius,
      flipX: n.flipX,
      clipsContent: n.clipsContent,
      fills: n.fills,
      fontWeight: n.fontWeight,
      italic: n.italic,
      styleRuns: n.styleRuns,
    }
  }, id)
}

export function getEditingTextId(page: Page) {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.editingTextId)
}
