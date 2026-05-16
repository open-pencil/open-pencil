import type { Page } from '@playwright/test'

export function getSelectedIds(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.selectedIds.size
  })
}

export function getPageChildren(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      layoutMode: n.layoutMode,
      childIds: n.childIds,
      vectorNetwork: n.vectorNetwork
    }))
  })
}

export function getSelectedNode(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      id: n.id,
      type: n.type,
      name: n.name,
      text: n.text,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation,
      visible: n.visible,
      layoutMode: n.layoutMode,
      primaryAxisAlign: n.primaryAxisAlign,
      counterAxisAlign: n.counterAxisAlign,
      itemSpacing: n.itemSpacing,
      childIds: n.childIds,
      cornerRadius: n.cornerRadius,
      independentCorners: n.independentCorners,
      independentStrokeWeights: n.independentStrokeWeights,
      flipX: n.flipX,
      clipsContent: n.clipsContent,
      fills: n.fills,
      strokes: n.strokes,
      fontSize: n.fontSize,
      fontFamily: n.fontFamily,
      fontWeight: n.fontWeight,
      italic: n.italic
    }
  })
}

export function getSelectedNodes(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds].map((id) => {
      const n = store.graph.getNode(id)
      if (!n) throw new Error(`Selected node ${id} not found`)
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        fills: n.fills
      }
    })
  })
}

export function getNodeById(page: Page, id: string) {
  return page.evaluate((nodeId: string) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
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
      counterAxisSpacing: n.counterAxisSpacing,
      layoutWrap: n.layoutWrap,
      paddingTop: n.paddingTop,
      paddingRight: n.paddingRight,
      paddingBottom: n.paddingBottom,
      paddingLeft: n.paddingLeft,
      minWidth: n.minWidth,
      maxWidth: n.maxWidth,
      minHeight: n.minHeight,
      maxHeight: n.maxHeight,
      childIds: n.childIds,
      cornerRadius: n.cornerRadius,
      flipX: n.flipX,
      clipsContent: n.clipsContent,
      fills: n.fills,
      fontWeight: n.fontWeight,
      italic: n.italic,
      styleRuns: n.styleRuns
    }
  }, id)
}

export function getEditingTextId(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.editingTextId
  })
}
