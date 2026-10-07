import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

/**
 * Opens a top-level menu. A menu that just closed stays in the page while it animates out, and a
 * click on a trigger then is lost, so this waits for it to go before clicking.
 */
async function openMenu(name: string) {
  await expect(editor.page.getByRole('menu')).toHaveCount(0)
  await editor.page.getByRole('menubar').getByRole('menuitem', { name, exact: true }).click()
  const menu = editor.page.getByRole('menu', { name })
  await expect(menu).toBeVisible()
  return menu
}

test('menu bar is visible in browser mode', async () => {
  const menubar = editor.page.locator('[role="menubar"]')
  await expect(menubar).toBeVisible()
})

test('menu bar has all top-level menus', async () => {
  const triggers = editor.page.locator('[role="menubar"] [role="menuitem"]')
  const labels = await triggers.allTextContents()
  expect(labels).toEqual(['File', 'Edit', 'View', 'Object', 'Text', 'Arrange'])
})

test('File menu opens and shows items', async () => {
  const menu = await openMenu('File')

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Open'))).toBe(true)
  expect(items.some((t) => t.includes('Open storage workspace'))).toBe(true)
  expect(items.some((t) => t.includes('Save'))).toBe(true)
  expect(items.some((t) => t.includes('Save as'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('Edit menu shows Undo/Redo/Delete', async () => {
  const menu = await openMenu('Edit')

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Undo'))).toBe(true)
  expect(items.some((t) => t.includes('Redo'))).toBe(true)
  expect(items.some((t) => t.includes('Delete'))).toBe(true)
  expect(items.some((t) => t.includes('Select all'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('View menu shows zoom options', async () => {
  const menu = await openMenu('View')

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Zoom to fit'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom in'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom out'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('Object menu shows Group/Ungroup/Component', async () => {
  const menu = await openMenu('Object')

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Group'))).toBe(true)
  expect(items.some((t) => t.includes('Ungroup'))).toBe(true)
  expect(items.some((t) => t.includes('Create component'))).toBe(true)
  expect(items.some((t) => t.includes('Bring to front'))).toBe(true)
  expect(items.some((t) => t.includes('Send to back'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

function getStoreStateNumber(key: 'selectedIds' | 'zoom') {
  return editor.page.evaluate((stateKey) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    if (stateKey === 'selectedIds') return store.state.selectedIds.size
    return store.state.zoom
  }, key)
}

test('Move to page is disabled without a selection', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.addPage('Second page')
    store.switchPage(store.graph.getPages()[0].id)
  })

  await openMenu('Object')
  const moveToPage = editor.page.getByRole('menuitem', { name: 'Move to page' })
  await expect(moveToPage).toHaveAttribute('data-disabled')
  await editor.page.keyboard.press('Escape')

  await editor.canvas.drawRect(200, 200, 100, 100)
  await openMenu('Object')
  await expect(editor.page.getByRole('menuitem', { name: 'Move to page' })).not.toHaveAttribute(
    'data-disabled'
  )
  await editor.page.keyboard.press('Escape')
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    for (const id of store.state.selectedIds) store.graph.deleteNode(id)
    store.clearSelection()
    store.undo.clear()
  })
})

test('Undo via Edit menu works', async () => {
  await editor.canvas.drawRect(200, 200, 100, 100)
  const beforeUndo = await getStoreStateNumber('selectedIds')
  expect(beforeUndo).toBe(1)

  await openMenu('Edit')
  const undoItem = editor.page.getByRole('menuitem', { name: /^Undo\b/ })
  await expect(undoItem).toBeEnabled()
  await undoItem.click()
  await editor.canvas.waitForRender()

  const afterUndo = await getStoreStateNumber('selectedIds')
  expect(afterUndo).toBe(0)

  await openMenu('Edit')
  await expect(editor.page.getByRole('menuitem', { name: /^Redo\b/ })).toBeEnabled()
  await editor.page.keyboard.press('Escape')
})

test('Duplicate via Edit menu works', async () => {
  await editor.canvas.drawRect(300, 300, 80, 80)

  const countBefore = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  const editMenu = await openMenu('Edit')
  await editMenu.locator('[role="menuitem"]', { hasText: 'Duplicate' }).click()
  await editor.canvas.waitForRender()

  const countAfter = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  expect(countAfter).toBe(countBefore + 1)
})

test('Zoom to fit via View menu works', async () => {
  const zoomInMenu = await openMenu('View')
  await zoomInMenu.locator('[role="menuitem"]', { hasText: 'Zoom in' }).click()
  await editor.canvas.waitForRender()

  const zoomBefore = await getStoreStateNumber('zoom')
  expect(zoomBefore).toBeGreaterThan(1)

  const zoomToFitMenu = await openMenu('View')
  await zoomToFitMenu.locator('[role="menuitem"]', { hasText: 'Zoom to fit' }).click()
  await editor.canvas.waitForRender()

  const zoomAfter = await getStoreStateNumber('zoom')
  expect(zoomAfter).not.toBe(zoomBefore)
})

test('Open storage workspace navigates from the File menu', async () => {
  await editor.page.getByRole('menuitem', { name: 'File', exact: true }).click()
  await editor.page.getByRole('menuitem', { name: 'Open storage workspace…' }).click()

  await expect(editor.page).toHaveURL(/\/$/)
  await expect(editor.page.getByTestId('recent-files-home')).toBeVisible()
  await expect(editor.page.getByRole('heading', { name: 'Storage workspace' })).toBeVisible()
})
