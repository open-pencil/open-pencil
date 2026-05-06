import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

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
    const store = window.openPencil?.store
    if (!store) throw new Error('OpenPencil store not initialized')
    const n = store.graph.getNode(nodeId)
    if (!n) return null
    return {
      fills: n.fills,
      strokes: n.strokes,
      effects: n.effects,
      opacity: n.opacity,
      visible: n.visible,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation
    }
  }, id)
}

function getSelectedId() {
  return page.evaluate(() => {
    const store = window.openPencil?.store
    if (!store) throw new Error('OpenPencil store not initialized')
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

test('clicking color area changes fill color', async () => {
  const id = await getSelectedId()
  const before = await getNode(expectDefined(id, 'selected id'))

  const swatch = fillSection().locator('[data-test-id="fill-picker-swatch"]').first()
  await swatch.click()

  const colorArea = page.locator('.cursor-crosshair').first()
  await expect(colorArea).toBeVisible({ timeout: 5000 })

  const box = await colorArea.boundingBox()
  await page.mouse.click(
    expectDefined(box, 'color area bounds').x + expectDefined(box, 'color area bounds').width - 10,
    expectDefined(box, 'color area bounds').y + 10
  )
  await canvas.waitForRender()
  await page.waitForTimeout(100)

  const after = await getNode(expectDefined(id, 'selected id'))
  const c1 = expectDefined(before, 'before node').fills[0].color
  const c2 = expectDefined(after, 'after node').fills[0].color
  expect(c1.r !== c2.r || c1.g !== c2.g || c1.b !== c2.b).toBe(true)

  // Close popover — click the swatch again to toggle it off
  await swatch.click()
  await canvas.waitForRender()
})

test('adding a stroke creates stroke section item', async () => {
  const addBtn = strokeSection().locator('[data-test-id="stroke-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const strokeItems = strokeSection().locator('[data-test-id="stroke-item"]')
  await expect(strokeItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').strokes.length).toBe(1)
})

test('adding an effect creates effect item', async () => {
  const addBtn = effectsSection().locator('[data-test-id="effects-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const effectItems = effectsSection().locator('[data-test-id="effect-item"]')
  await expect(effectItems.first()).toBeVisible()

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').effects.length).toBe(1)
})

test('adding a second fill shows two fill items', async () => {
  const addBtn = fillSection().locator('[data-test-id="fill-section-add"]')
  await addBtn.click()
  await canvas.waitForRender()

  const fillItems = fillSection().locator('[data-test-id="fill-item"]')
  expect(await fillItems.count()).toBe(2)

  const id = await getSelectedId()
  const node = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(node, 'node node').fills.length).toBe(2)
})

test('visibility toggle in appearance section works', async () => {
  const visBtn = page.locator('[data-test-id="appearance-visibility"]')
  await expect(visBtn).toBeVisible()

  const id = await getSelectedId()
  const before = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(before, 'before node').visible).toBe(true)

  await visBtn.click()
  await canvas.waitForRender()

  const after = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(after, 'after node').visible).toBe(false)

  await visBtn.click()
  await canvas.waitForRender()

  const restored = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(restored, 'restored node').visible).toBe(true)
})

test('fill stroke and effect visibility toggles update on repeated clicks and support undo redo', async () => {
  const id = await getSelectedId()
  expect(id).toBeTruthy()

  const fillButton = page.locator('[data-test-id="fill-visibility-0"]')
  await expect(fillButton).toBeVisible()

  const initial = await getNode(expectDefined(id, 'selected id'))
  expect(expectDefined(initial, 'initial node').fills[0]?.visible).toBe(true)

  await fillButton.click()
  await canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(false)

  await fillButton.click()
  await canvas.waitForRender()
  await expect(fillButton).toHaveAttribute('data-visible', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(true)

  await canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(false)
  await canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').fills[0]
      ?.visible
  ).toBe(true)

  const strokeAddButton = strokeSection().locator('[data-test-id="stroke-section-add"]')
  await strokeAddButton.click()
  await canvas.waitForRender()

  const strokeButton = page.locator('[data-test-id="stroke-visibility-0"]')
  await expect(strokeButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  await strokeButton.click()
  await canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(false)

  await strokeButton.click()
  await canvas.waitForRender()
  await expect(strokeButton).toHaveAttribute('data-visible', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  await canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(false)
  await canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').strokes[0]
      ?.visible
  ).toBe(true)

  const effectAddButton = effectsSection().locator('[data-test-id="effects-section-add"]')
  await effectAddButton.click()
  await canvas.waitForRender()

  const effectButton = page.locator('[data-test-id="effect-visibility-0"]')
  await expect(effectButton).toBeVisible()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)

  await effectButton.click()
  await canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('data-visible', 'false')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(false)

  await effectButton.click()
  await canvas.waitForRender()
  await expect(effectButton).toHaveAttribute('data-visible', 'true')
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)

  await canvas.undo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(false)
  await canvas.redo()
  expect(
    expectDefined(await getNode(expectDefined(id, 'selected id')), 'selected node').effects[0]
      ?.visible
  ).toBe(true)
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
