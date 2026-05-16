import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

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
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'File' }).click()
  const menu = editor.page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Open'))).toBe(true)
  expect(items.some((t) => t.includes('Save'))).toBe(true)
  expect(items.some((t) => t.includes('Save As'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('Edit menu shows Undo/Redo/Delete', async () => {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  const menu = editor.page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Undo'))).toBe(true)
  expect(items.some((t) => t.includes('Redo'))).toBe(true)
  expect(items.some((t) => t.includes('Delete'))).toBe(true)
  expect(items.some((t) => t.includes('Select all'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('View menu shows zoom options', async () => {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  const menu = editor.page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

  const items = await menu.locator('[role="menuitem"]').allTextContents()
  expect(items.some((t) => t.includes('Zoom to fit'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom In'))).toBe(true)
  expect(items.some((t) => t.includes('Zoom Out'))).toBe(true)

  await editor.page.keyboard.press('Escape')
})

test('Object menu shows Group/Ungroup/Component', async () => {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Object' }).click()
  const menu = editor.page.locator('[role="menu"]')
  await expect(menu).toBeVisible()

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

test('Undo via Edit menu works', async () => {
  await editor.canvas.drawRect(200, 200, 100, 100)
  const beforeUndo = await getStoreStateNumber('selectedIds')
  expect(beforeUndo).toBe(1)

  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Undo' }).click()
  await editor.canvas.waitForRender()

  const afterUndo = await getStoreStateNumber('selectedIds')
  expect(afterUndo).toBe(0)
})

test('Duplicate via Edit menu works', async () => {
  await editor.canvas.drawRect(300, 300, 80, 80)

  const countBefore = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'Edit' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Duplicate' }).click()
  await editor.canvas.waitForRender()

  const countAfter = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })

  expect(countAfter).toBe(countBefore + 1)
})

test('Zoom to fit via View menu works', async () => {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Zoom in' }).click()
  await editor.canvas.waitForRender()

  const zoomBefore = await getStoreStateNumber('zoom')
  expect(zoomBefore).toBeGreaterThan(1)

  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'View' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Zoom to fit' }).click()
  await editor.canvas.waitForRender()

  const zoomAfter = await getStoreStateNumber('zoom')
  expect(zoomAfter).not.toBe(zoomBefore)
})
