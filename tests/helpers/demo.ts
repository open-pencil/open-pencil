import type { Page } from '@playwright/test'

export async function waitForDemo(page: Page) {
  await page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store?.graph.getNode(store.state.currentPageId)?.name === '01 · Components & variables' &&
      store.state.preparation === null
    )
  })
}
