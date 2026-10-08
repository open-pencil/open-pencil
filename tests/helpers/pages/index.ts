import { expect, type Page } from '@playwright/test'

/** Setup: add pages by name without visiting them. */
export function addPages(page: Page, names: string[]): Promise<void> {
  return page.evaluate((pageNames) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const name of pageNames) store.graph.addPage(name)
    store.requestRender()
  }, names)
}

/** Probe: the name of the page on screen. */
export function currentPageName(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getNode(store.state.currentPageId)?.name
  })
}

/** Driver: open a page from the Pages panel, as a user would. */
export async function visitPage(page: Page, name: string): Promise<void> {
  // Exact text, so "Chapter 1" does not also match "Chapter 10".
  await page
    .getByTestId('pages-row')
    .filter({ has: page.getByText(name, { exact: true }) })
    .click()
  await expect.poll(() => currentPageName(page)).toBe(name)
}
