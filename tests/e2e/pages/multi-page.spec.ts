import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

function getPages() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getPages().map((p) => ({ id: p.id, name: p.name }))
  })
}

function getCurrentPageId() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.currentPageId
  })
}

function getPageChildCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
}

function pagesPanel() {
  return editor.page.getByTestId('pages-panel')
}

function pageItems() {
  return editor.page.getByTestId('pages-item')
}

function addPageButton() {
  return editor.page.getByTestId('pages-add')
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
  await editor.canvas.waitForRender()

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
  await editor.canvas.drawRect(100, 100, 80, 60)
  await editor.canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)
})

test('switching to first page shows its content', async () => {
  await pageItems().first().click()
  await editor.canvas.waitForRender()

  const pages = await getPages()
  const currentId = await getCurrentPageId()
  expect(currentId).toBe(pages[0].id)
})

test('first page has no shapes (we never drew on it)', async () => {
  expect(await getPageChildCount()).toBe(0)
})

test('switching back to second page shows its shape', async () => {
  await pageItems().nth(1).click()
  await editor.canvas.waitForRender()

  expect(await getPageChildCount()).toBe(1)
})

test('add a third page', async () => {
  await addPageButton().click()
  await editor.canvas.waitForRender()

  const pages = await getPages()
  expect(pages).toHaveLength(3)
  expect(await pageItems().count()).toBe(3)
})

test('delete current page switches to adjacent', async () => {
  const pagesBefore = await getPages()
  const deletingId = await getCurrentPageId()

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.deletePage(store.state.currentPageId)
  })
  await editor.canvas.waitForRender()

  const pagesAfter = await getPages()
  expect(pagesAfter).toHaveLength(pagesBefore.length - 1)
  expect(pagesAfter.find((p) => p.id === deletingId)).toBeUndefined()

  const currentId = await getCurrentPageId()
  expect(pagesAfter.some((p) => p.id === currentId)).toBe(true)
})

test('rename page via store', async () => {
  const currentId = await getCurrentPageId()

  await editor.page.evaluate(
    ([id, name]) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.renamePage(id, name)
    },
    [currentId, 'Renamed Page'] as [string, string]
  )
  await editor.canvas.waitForRender()

  const updated = await getPages()
  const renamed = updated.find((p) => p.id === currentId)
  expect(renamed?.name).toBe('Renamed Page')

  editor.canvas.assertNoErrors()
})

test('double-click page to rename', async () => {
  const item = pageItems().first()
  await item.dblclick()

  const input = editor.page.getByTestId('pages-item-input')
  await expect(input).toBeVisible()
  await input.fill('My Page')
  await input.press('Enter')

  await editor.canvas.waitForRender()
  const pages = await getPages()
  expect(pages.some((p) => p.name === 'My Page')).toBe(true)

  editor.canvas.assertNoErrors()
})

test('clicking outside page rename input commits', async () => {
  const item = pageItems().first()
  await item.dblclick()

  const input = editor.page.getByTestId('pages-item-input')
  await expect(input).toBeVisible()
  await input.fill('Outside Click Page')

  // Click on the page header label to trigger blur (outside the input but still in the panel)
  await editor.page.getByTestId('pages-header').click()
  await editor.canvas.waitForRender()

  await expect(input).not.toBeVisible()
  const pages = await getPages()
  expect(pages.some((p) => p.name === 'Outside Click Page')).toBe(true)

  editor.canvas.assertNoErrors()
})

test('cannot delete the last page', async () => {
  // Delete until 1 remains
  let pages = await getPages()
  while (pages.length > 1) {
    await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.deletePage(store.state.currentPageId)
    })
    await editor.canvas.waitForRender()
    pages = await getPages()
  }

  expect(pages).toHaveLength(1)

  // Try deleting the last one — should be a no-op
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.deletePage(store.state.currentPageId)
  })
  await editor.canvas.waitForRender()

  const after = await getPages()
  expect(after).toHaveLength(1)

  editor.canvas.assertNoErrors()
})
