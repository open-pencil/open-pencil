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

function getPageChildren() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return store.graph.getChildren(store.state.currentPageId).map((n) => ({
      id: n.id,
      type: n.type,
      name: n.name,
      visible: n.visible,
      locked: n.locked
    }))
  })
}

function getSelectedCount() {
  return page.evaluate(() => window.__OPEN_PENCIL_STORE__!.state.selectedIds.size)
}

async function rightClickShape(x: number, y: number) {
  const box = await canvas.canvas.boundingBox()
  await page.mouse.click(box!.x + x, box!.y + y, { button: 'right' })
}

function contextMenu() {
  return page.locator('[role="menu"]')
}

function contextItem(testId: string) {
  return page.locator(`[data-test-id="${testId}"]`)
}

test('right-click on empty canvas shows context menu without selection items disabled', async () => {
  await rightClickShape(500, 400)

  await expect(contextMenu()).toBeVisible()

  const copyItem = contextItem('context-copy')
  await expect(copyItem).toBeVisible()

  await page.keyboard.press('Escape')
})

test('draw shape and right-click selects it', async () => {
  await canvas.drawRect(200, 200, 120, 80)
  await canvas.waitForRender()

  // Deselect first
  await page.keyboard.press('Escape')
  await canvas.waitForRender()

  // Right-click the shape
  await rightClickShape(250, 230)

  expect(await getSelectedCount()).toBe(1)
  await expect(contextMenu()).toBeVisible()
})

test('context menu shows expected items', async () => {
  await expect(contextItem('context-copy')).toBeVisible()
  await expect(contextItem('context-cut')).toBeVisible()
  await expect(contextItem('context-duplicate')).toBeVisible()
  await expect(contextItem('context-delete')).toBeVisible()
  await expect(contextItem('context-group')).toBeVisible()
  await expect(contextItem('context-bring-to-front')).toBeVisible()
  await expect(contextItem('context-send-to-back')).toBeVisible()
  await expect(contextItem('context-toggle-visibility')).toBeVisible()
  await expect(contextItem('context-toggle-lock')).toBeVisible()

  await page.keyboard.press('Escape')
})

test('duplicate via context menu works', async () => {
  const countBefore = (await getPageChildren()).length

  await rightClickShape(250, 230)
  await contextItem('context-duplicate').click()
  await canvas.waitForRender()

  const countAfter = (await getPageChildren()).length
  expect(countAfter).toBe(countBefore + 1)
})

test('toggle visibility via context menu', async () => {
  await canvas.click(250, 230)
  await canvas.waitForRender()

  const nodeId = await page.evaluate(() => [...window.__OPEN_PENCIL_STORE__!.state.selectedIds][0])

  await rightClickShape(250, 230)
  await contextItem('context-toggle-visibility').click()
  await canvas.waitForRender()

  const hidden = await page.evaluate((id) => {
    const n = window.__OPEN_PENCIL_STORE__!.graph.getNode(id)
    return n ? { visible: n.visible } : null
  }, nodeId)
  expect(hidden!.visible).toBe(false)

  // Toggle back: select via store since invisible nodes can't be hit-tested
  await page.evaluate((id) => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.toggleVisibility()
  }, nodeId)
  await canvas.waitForRender()

  const restored = await page.evaluate((id) => {
    const n = window.__OPEN_PENCIL_STORE__!.graph.getNode(id)
    return n ? { visible: n.visible } : null
  }, nodeId)
  expect(restored!.visible).toBe(true)
})

test('toggle lock via context menu', async () => {
  await rightClickShape(250, 230)
  await contextItem('context-toggle-lock').click()
  await canvas.waitForRender()

  const children = await getPageChildren()
  const locked = children.find((c) => c.locked)
  expect(locked).toBeTruthy()

  // Unlock
  await rightClickShape(250, 230)
  await contextItem('context-toggle-lock').click()
  await canvas.waitForRender()

  const after = await getPageChildren()
  expect(after.every((c) => !c.locked)).toBe(true)
})

test('delete via context menu removes node', async () => {
  const countBefore = (await getPageChildren()).length

  await rightClickShape(250, 230)
  await contextItem('context-delete').click()
  await canvas.waitForRender()

  const countAfter = (await getPageChildren()).length
  expect(countAfter).toBe(countBefore - 1)
})

test('group via context menu', async () => {
  await canvas.clearCanvas()
  await canvas.drawRect(100, 100, 60, 60)
  await canvas.drawRect(200, 100, 60, 60)
  await canvas.selectAll()
  await canvas.waitForRender()

  await rightClickShape(130, 130)
  await contextItem('context-group').click()
  await canvas.waitForRender()

  const children = await getPageChildren()
  const group = children.find((c) => c.type === 'GROUP')
  expect(group).toBeTruthy()
})

test('ungroup via store after context-menu group', async () => {
  // Groups are click-through, so ungroup via store instead
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const group = store.graph.getChildren(store.state.currentPageId).find((n) => n.type === 'GROUP')
    if (group) store.select([group.id])
    store.ungroupSelected()
  })
  await canvas.waitForRender()

  const children = await getPageChildren()
  expect(children.every((c) => c.type !== 'GROUP')).toBe(true)
  expect(children.length).toBe(2)

  canvas.assertNoErrors()
})

test('create component via context menu', async () => {
  await canvas.click(130, 130)
  await canvas.waitForRender()

  await rightClickShape(130, 130)
  await contextItem('context-create-component').click()
  await canvas.waitForRender()

  const children = await getPageChildren()
  const comp = children.find((c) => c.type === 'COMPONENT')
  expect(comp).toBeTruthy()

  canvas.assertNoErrors()
})

test('Copy/Paste as submenu exists', async () => {
  await rightClickShape(130, 130)

  const submenuTrigger = contextItem('context-copy-paste-as')
  await expect(submenuTrigger).toBeVisible()

  await submenuTrigger.hover()
  await page.waitForTimeout(300)

  await expect(contextItem('context-copy-as-svg')).toBeVisible()
  await expect(contextItem('context-copy-as-jsx')).toBeVisible()

  await page.keyboard.press('Escape')
})
