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

function codeTab() {
  return page.locator('[data-test-id="properties-tab-code"]')
}

function designTab() {
  return page.locator('[data-test-id="properties-tab-design"]')
}

function codePanel() {
  return page.locator('[data-test-id="code-panel"]')
}

function codePanelEmpty() {
  return page.locator('[data-test-id="code-panel-empty"]')
}

function formatToggle() {
  return page.locator('[data-test-id="code-panel-format-toggle"]')
}

function copyButton() {
  return page.locator('[data-test-id="code-panel-copy"]')
}

test('Code tab shows empty state with no selection', async () => {
  await codeTab().click()
  await expect(codePanelEmpty()).toBeVisible()
  await expect(codePanelEmpty()).toContainText('Select a layer')
})

test('selecting a rectangle shows JSX code', async () => {
  await canvas.drawRect(100, 100, 200, 150)
  await canvas.waitForRender()

  await expect(codePanel()).toBeVisible()

  const code = await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="code-panel"]')
    return el?.textContent ?? ''
  })
  expect(code).toContain('Rectangle')
})

test('format toggle switches between OpenPencil and Tailwind', async () => {
  await expect(formatToggle()).toBeVisible()

  const initialFormat = await formatToggle().textContent()
  expect(initialFormat).toContain('OpenPencil')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('Tailwind')

  const code = await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="code-panel"]')
    return el?.textContent ?? ''
  })
  expect(code).toContain('div')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('OpenPencil')
})

test('copy button works and shows confirmation', async () => {
  await copyButton().click()

  await expect(copyButton()).toContainText('Copied')

  await page.waitForTimeout(2500)
  await expect(copyButton()).toContainText('Copy')
})

test('deselecting shows empty state again', async () => {
  await page.keyboard.press('Escape')
  await canvas.waitForRender()

  await expect(codePanelEmpty()).toBeVisible()
})

test('selecting a frame shows Frame in JSX', async () => {
  // Create a frame via store to avoid click-targeting issues
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = store.createShape('FRAME', 300, 100, 200, 200)
    store.select([id])
  })
  await canvas.waitForRender()

  const code = await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="code-panel"]')
    return el?.textContent ?? ''
  })
  expect(code).toContain('Frame')
})

test('switching back to Design tab works', async () => {
  await designTab().click()

  const panel = page.locator('[data-test-id="design-panel-single"], [data-test-id="design-panel-empty"]')
  await expect(panel.first()).toBeVisible()
})
