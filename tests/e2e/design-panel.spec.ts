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

function designPanel() {
  return page.locator('[data-test-id="design-panel-single"]')
}

function nodeHeader() {
  return page.locator('[data-test-id="design-node-header"]')
}

function fillSection() {
  return page.locator('[data-test-id="fill-section"]')
}

function strokeSection() {
  return page.locator('[data-test-id="stroke-section"]')
}

function positionSection() {
  return page.locator('[data-test-id="position-section"]')
}

function effectsSection() {
  return page.locator('[data-test-id="effects-section"]')
}

function getNode(id: string) {
  return page.evaluate((nodeId) => {
    const store = window.__OPEN_PENCIL_STORE__!
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return { fills: n.fills, strokes: n.strokes, effects: n.effects, opacity: n.opacity, visible: n.visible, x: n.x, y: n.y, width: n.width, height: n.height, rotation: n.rotation }
  }, id)
}

function getSelectedId() {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    return [...store.state.selectedIds][0] ?? null
  })
}

test('selecting a rectangle shows design panel with type and name', async () => {
  await canvas.drawRect(100, 100, 120, 80)
  await canvas.waitForRender()

  await expect(designPanel()).toBeVisible()
  await expect(nodeHeader()).toContainText('RECTANGLE')
  await expect(nodeHeader()).toContainText('Rectangle')
})

test('position section shows X, Y, rotation inputs', async () => {
  await expect(positionSection()).toBeVisible()

  const inputs = positionSection().locator('[data-test-id="scrub-input"]')
  const count = await inputs.count()
  expect(count).toBeGreaterThanOrEqual(3)
})

test('fill section appears with default fill', async () => {
  await expect(fillSection()).toBeVisible()

  const fillItems = fillSection().locator('[data-test-id="fill-item"]')
  await expect(fillItems.first()).toBeVisible()
})

test('fill item shows color swatch', async () => {
  const swatch = fillSection().locator('[data-test-id="fill-picker-swatch"]').first()
  await expect(swatch).toBeVisible()
})

test('adding a stroke creates stroke section item', async () => {
  const addBtn = strokeSection().locator('[data-test-id="stroke-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const strokeItems = strokeSection().locator('[data-test-id="stroke-item"]')
  await expect(strokeItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(id!)
  expect(node!.strokes.length).toBe(1)
})

test('adding an effect creates effect item', async () => {
  const addBtn = effectsSection().locator('[data-test-id="effects-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const effectItems = effectsSection().locator('[data-test-id="effects-item"]')
  await expect(effectItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(id!)
  expect(node!.effects.length).toBe(1)
})

test('adding a second fill shows two fill items', async () => {
  const addBtn = fillSection().locator('[data-test-id="fill-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const fillItems = fillSection().locator('[data-test-id="fill-item"]')
  expect(await fillItems.count()).toBe(2)

  const id = await getSelectedId()
  const node = await getNode(id!)
  expect(node!.fills.length).toBe(2)
})

test('visibility toggle in appearance section works', async () => {
  const visBtn = page.locator('[data-test-id="appearance-visibility"]')
  await expect(visBtn).toBeVisible()

  const id = await getSelectedId()
  const before = await getNode(id!)
  expect(before!.visible).toBe(true)

  await visBtn.click()
  await canvas.waitForRender()

  const after = await getNode(id!)
  expect(after!.visible).toBe(false)

  await visBtn.click()
  await canvas.waitForRender()

  const restored = await getNode(id!)
  expect(restored!.visible).toBe(true)
})

test('deselecting shows empty design panel', async () => {
  await page.keyboard.press('Escape')
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="design-panel-empty"]')).toBeVisible()
})

test('multi-select shows mixed header', async () => {
  await canvas.drawRect(300, 100, 60, 60)
  await canvas.drawRect(400, 100, 60, 60)
  await canvas.selectAll()
  await canvas.waitForRender()

  const multiHeader = page.locator('[data-test-id="design-multi-header"]')
  await expect(multiHeader).toBeVisible()
  await expect(multiHeader).toContainText('Mixed')
  await expect(multiHeader).toContainText('layers')
})
