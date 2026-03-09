import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getPageChildren } from '../helpers/store'

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

test('shapes flyout opens', async () => {
  await page.locator('[data-test-id="toolbar-flyout-rectangle"]').click()
  await expect(page.locator('[data-test-id="toolbar-flyout-item-polygon"]')).toBeVisible()
  canvas.assertNoErrors()
})

test('Polygon tool creates POLYGON node', async () => {
  await page.locator('[data-test-id="toolbar-flyout-item-polygon"]').click()
  await canvas.drag(300, 200, 400, 300)
  await canvas.waitForRender()

  const children = await getPageChildren(page)
  expect(children.some(n => n.type === 'POLYGON')).toBe(true)
  canvas.assertNoErrors()
})

test('Star tool creates STAR node', async () => {
  await page.locator('[data-test-id="toolbar-flyout-rectangle"]').click()
  await page.locator('[data-test-id="toolbar-flyout-item-star"]').click()
  await canvas.drag(150, 150, 250, 250)
  await canvas.waitForRender()

  const children = await getPageChildren(page)
  expect(children.some(n => n.type === 'STAR')).toBe(true)
  canvas.assertNoErrors()
})

test('Pen creates VECTOR node with 3 vertices on Enter', async () => {
  await canvas.pressKey('Escape')
  await canvas.pressKey('p')
  await canvas.click(100, 400)
  await canvas.waitForRender()
  await canvas.click(200, 400)
  await canvas.waitForRender()
  await canvas.click(200, 480)
  await canvas.waitForRender()
  await canvas.pressKey('Enter')
  await canvas.waitForRender()

  const children = await getPageChildren(page)
  const vectors = children.filter(n => n.type === 'VECTOR')
  expect(vectors.length).toBeGreaterThan(0)
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.vertices.length).toBe(3)
  canvas.assertNoErrors()
})

test('Pen Escape with 2 vertices cancels path without creating node', async () => {
  const before = (await getPageChildren(page)).filter(n => n.type === 'VECTOR').length

  await canvas.pressKey('p')
  await canvas.click(350, 400)
  await canvas.waitForRender()
  await canvas.click(440, 400)
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const after = (await getPageChildren(page)).filter(n => n.type === 'VECTOR').length
  expect(after).toBe(before)
  canvas.assertNoErrors()
})

test('Pen close path creates VECTOR with closed region', async () => {
  const before = (await getPageChildren(page)).filter(n => n.type === 'VECTOR').length

  await canvas.pressKey('p')
  await canvas.click(500, 200)
  await canvas.waitForRender()
  await canvas.click(580, 200)
  await canvas.waitForRender()
  await canvas.click(540, 270)
  await canvas.waitForRender()
  await canvas.click(500, 200)
  await canvas.waitForRender()

  const after = (await getPageChildren(page)).filter(n => n.type === 'VECTOR').length
  expect(after).toBeGreaterThan(before)

  const vectors = (await getPageChildren(page)).filter(n => n.type === 'VECTOR')
  const last = vectors[vectors.length - 1]
  expect(last.vectorNetwork.regions?.length).toBeGreaterThan(0)
  canvas.assertNoErrors()
})

test('Frame flyout shows Frame and Section items', async () => {
  await page.locator('[data-test-id="toolbar-flyout-frame"]').click()
  await expect(page.locator('[data-test-id="toolbar-flyout-item-frame"]')).toBeVisible()
  await expect(page.locator('[data-test-id="toolbar-flyout-item-section"]')).toBeVisible()
  canvas.assertNoErrors()
})
