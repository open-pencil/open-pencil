import type { Page } from '@playwright/test'

export type CodeNodeSummary = {
  type: string
  name: string
  text: string
}

export function getFirstSelectedNodeId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds][0] ?? null
  })
}

export function hasNode(page: Page, id: string | null): Promise<boolean> {
  return page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return nodeId !== null && store.graph.getNode(nodeId) !== undefined
  }, id)
}

export function hasNodeNamed(page: Page, name: string): Promise<boolean> {
  return page.evaluate((nodeName) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.getAllNodes()].some((node) => node.name === nodeName)
  }, name)
}

export async function waitForNode(page: Page, id: string | null): Promise<void> {
  await page.waitForFunction((nodeId) => {
    const store = window.openPencil?.getStore?.()
    return nodeId !== null && store?.graph.getNode(nodeId) !== undefined
  }, id)
}

export async function waitForNodeNamed(page: Page, name: string): Promise<void> {
  await page.waitForFunction((nodeName) => {
    const store = window.openPencil?.getStore?.()
    return [...(store?.graph.getAllNodes() ?? [])].some((node) => node.name === nodeName)
  }, name)
}

export function getCodeNodeSummaries(page: Page): Promise<CodeNodeSummary[]> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.getAllNodes()].map((node) => ({
      type: node.type,
      name: node.name,
      text: node.text
    }))
  })
}

export function getUndoLabel(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.undo.undoLabel
  })
}

export function getMobileDrawerSnap(page: Page): Promise<string> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.mobileDrawerSnap
  })
}
