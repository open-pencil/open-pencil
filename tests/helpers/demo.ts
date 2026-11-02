import type { Page } from '@playwright/test'

export async function waitForDemo(page: Page) {
  await page.waitForFunction(() => {
    const store = window.lawha?.getStore?.()
    return (
      store?.graph.getNode(store.state.currentPageId)?.name === 'Tour' &&
      store.state.preparation === null
    )
  })
}
