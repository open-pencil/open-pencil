import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

function getPages() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getPages().map((p) => ({ id: p.id, name: p.name }))
  })
}

function getCurrentPageId() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.currentPageId)
}

function getPageChildCount() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).length
  })
}

function pagesPanel() {
  return page.locator('[data-test-id="pages-panel"]')
}

function pageItems() {
  return page.locator('[data-test-id="pages-item"]')
}

function addPageButton() {
  return page.locator('[data-test-id="pages-add"]')
}

test('initial state has one page', async () => {
  const pages = await getPages()
  expect(pages).toHaveLength(1)
  expect(pages[0].name).toBe('Page 1')
})

test('pages panel shows current page', async () => {
  await expect(pagesPanel()).toBeVisible()
  await expect(pageItems().first()).toContainText('Page 1')
})

test('add page creates a second page', async () => {
  await addPageButton().click()
  await canvas.waitForRender()

  const pages = await getPages()
  expect(pages).toHaveLength(2)

  expect(await pageItems().count()).toBe(2)
})

test('new page is auto-selected', async () => {
  const pages = await getPages()
  const currentId = await getCurrentPageId()
  expect(currentId).toBe(pages[1].id)
})

test('new page is empty', async () => {
  expect(await getPageChildCount()).toBe(0)
})

test('drawing on new page adds nodes only to it', async () => {
  await canvas.drawRect(100, 100, 80, 60)
  await canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)
})

test('switching to first page shows its content', async () => {
  await pageItems().first().click()
  await canvas.waitForRender()

  const pages = await getPages()
  const currentId = await getCurrentPageId()
  expect(currentId).toBe(pages[0].id)
})

test('first page has no shapes (we never drew on it)', async () => {
  expect(await getPageChildCount()).toBe(0)
})

test('switching back to second page shows its shape', async () => {
  await pageItems().nth(1).click()
  await canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)
})

test('add a third page', async () => {
  await addPageButton().click()
  await canvas.waitForRender()

  const pages = await getPages()
  expect(pages).toHaveLength(3)
  expect(await pageItems().count()).toBe(3)
})

test('delete current page switches to adjacent', async () => {
  const pagesBefore = await getPages()
  const deletingId = await getCurrentPageId()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.deletePage(store.state.currentPageId)
  })
  await canvas.waitForRender()

  const pagesAfter = await getPages()
  expect(pagesAfter).toHaveLength(pagesBefore.length - 1)
  expect(pagesAfter.find((p) => p.id === deletingId)).toBeUndefined()

  const currentId = await getCurrentPageId()
  expect(pagesAfter.some((p) => p.id === currentId)).toBe(true)
})

test('rename page via store', async () => {
  const pages = await getPages()
  const currentId = await getCurrentPageId()

  await page.evaluate(
    ([id, name]) => {
      window.__OPEN_PENCIL_STORE__!.renamePage(id, name)
    },
    [currentId, 'Renamed Page'] as [string, string]
  )
  await canvas.waitForRender()

  const updated = await getPages()
  const renamed = updated.find((p) => p.id === currentId)
  expect(renamed!.name).toBe('Renamed Page')

  canvas.assertNoErrors()
})

test('double-click page to rename', async () => {
  const item = pageItems().first()
  await item.dblclick()

  const input = page.locator('[data-test-id="pages-item-input"]')
  await expect(input).toBeVisible()
  await input.fill('My Page')
  await input.press('Enter')

  await canvas.waitForRender()
  const pages = await getPages()
  expect(pages.some((p) => p.name === 'My Page')).toBe(true)

  canvas.assertNoErrors()
})

test('clicking outside page rename input commits', async () => {
  const item = pageItems().first()
  await item.dblclick()

  const input = page.locator('[data-test-id="pages-item-input"]')
  await expect(input).toBeVisible()
  await input.fill('Outside Click Page')

  await page.mouse.click(500, 400)
  await canvas.waitForRender()

  await expect(input).not.toBeVisible()
  const pages = await getPages()
  expect(pages.some((p) => p.name === 'Outside Click Page')).toBe(true)

  canvas.assertNoErrors()
})

test('cannot delete the last page', async () => {
  // Delete until 1 remains
  let pages = await getPages()
  while (pages.length > 1) {
    await page.evaluate(() => {
      const store = window.__OPEN_PENCIL_STORE__!
      store.deletePage(store.state.currentPageId)
    })
    await canvas.waitForRender()
    pages = await getPages()
  }

  expect(pages).toHaveLength(1)

  // Try deleting the last one — should be a no-op
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.deletePage(store.state.currentPageId)
  })
  await canvas.waitForRender()

  const after = await getPages()
  expect(after).toHaveLength(1)

  canvas.assertNoErrors()
})
