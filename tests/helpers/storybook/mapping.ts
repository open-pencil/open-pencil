import type { Page } from '@playwright/test'

import type * as AppTabs from '@/app/tabs'

/** Opens a real archive through the same tab loader as the file picker, then selects its component. */
export async function openMappedDesign(page: Page, bytes: Uint8Array, sourceId: string) {
  await page.evaluate(
    async ({ data, id }) => {
      const tabsURL = '/src/app/tabs/index.ts'
      const tabs: typeof AppTabs = await import(tabsURL)
      await tabs.openFileInNewTab(new File([new Uint8Array(data)], 'library.fig'))
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor not initialized')
      for (const page of store.graph.getPages()) await store.loadPageNodes(page.id)
      const node = [...store.graph.getAllNodes()].find((item) => item.source.id === id)
      if (!node) throw new Error('Persisted component not found after reopening archive')
      if (node.parentId) await store.switchPage(node.parentId)
      store.select([node.id])
    },
    { data: [...bytes], id: sourceId }
  )
}

export async function selectedDesignSourceIds(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor not initialized')
    return [...store.state.selectedIds].map((id) => store.graph.getNode(id)?.source.id ?? null)
  })
}
