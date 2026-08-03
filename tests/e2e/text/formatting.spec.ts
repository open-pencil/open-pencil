import { test, expect, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { getSelectedNode, getEditingTextId, getNodeById } from '#tests/helpers/store'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/editor')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
  })
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('double-click enters text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})

test('typography controls use compact labeled anatomy', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  await canvas.click(275, 215)
  await canvas.waitForRender()

  const typography = page.getByRole('region', { name: 'Typography' })
  await expect(typography.getByRole('button', { name: 'Font family' })).toBeVisible()
  await expect(typography.getByRole('combobox', { name: 'Font weight' })).toBeVisible()
  await expect(typography.getByRole('spinbutton', { name: 'Font size' })).toBeVisible()
  await expect(typography.getByRole('spinbutton', { name: 'Line height' })).toBeVisible()
  await expect(typography.getByRole('spinbutton', { name: 'Letter spacing' })).toBeVisible()
  await expect(typography.getByRole('combobox', { name: 'Direction' })).toBeVisible()
  await expect(typography.getByRole('combobox', { name: 'Text case' })).toBeVisible()
  await expect(typography.getByRole('combobox', { name: 'Truncation' })).toBeVisible()
  await expect(typography.getByRole('switch', { name: 'Standard ligatures' })).toBeVisible()

  const alignment = typography.getByRole('group', { name: 'Text alignment' })
  await expect(alignment.getByRole('button', { name: 'Align left' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await alignment.getByRole('button', { name: 'Align center horizontally' }).click()
  await canvas.waitForRender()
  await expect(
    alignment.getByRole('button', { name: 'Align center horizontally' })
  ).toHaveAttribute('aria-pressed', 'true')

  await expect(typography).toHaveScreenshot('typography-panel.png')
})

test('advanced typography controls update case, alignment, truncation, and features', async () => {
  const typography = page.getByRole('region', { name: 'Typography' })
  const nodeId = expectDefined(await getSelectedNode(page), 'selected text node').id

  const vertical = typography.getByRole('group', { name: 'Vertical text alignment' })
  await vertical.getByRole('button', { name: 'Align bottom' }).click()

  await typography.getByRole('combobox', { name: 'Text case' }).click()
  await page.getByRole('option', { name: 'Uppercase' }).click()

  await typography.getByRole('combobox', { name: 'Truncation' }).click()
  await page.getByRole('option', { name: 'Ending ellipsis' }).click()
  const maxLines = typography.getByRole('spinbutton', { name: 'Maximum lines' })
  await maxLines.click()
  await page.keyboard.press('Meta+a')
  await page.keyboard.type('2')
  await page.keyboard.press('Enter')

  await typography.getByRole('switch', { name: 'Standard ligatures' }).click()
  await canvas.waitForRender()

  const node = await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const current = store?.graph.getNode(id)
    return current
      ? {
          textAlignVertical: current.textAlignVertical,
          textCase: current.textCase,
          textTruncation: current.textTruncation,
          maxLines: current.maxLines,
          fontFeatures: current.fontFeatures
        }
      : null
  }, nodeId)
  expect(node).toMatchObject({
    textAlignVertical: 'BOTTOM',
    textCase: 'UPPER',
    textTruncation: 'ENDING',
    maxLines: 2
  })
  expect(node?.fontFeatures).toContainEqual({ tag: 'LIGA', enabled: false })
})

test('bold button toggles fontWeight to 700 then back to 400', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  await canvas.click(275, 215)
  await canvas.waitForRender()

  const nodeId = expectDefined(await getSelectedNode(page), 'selected text node').id

  // ensure starting weight is 400 via undo-safe store method
  await page.evaluate(async (id: string) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.updateNodeWithUndo(id, { fontWeight: 400 }, 'reset')
    store.state.sceneVersion++
    await new Promise(requestAnimationFrame)
  }, nodeId)
  await canvas.waitForRender()

  const boldBtn = page.getByRole('toolbar', { name: 'Text formatting' }).getByRole('button', {
    name: /^Bold/
  })
  await expect(boldBtn).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(200)
  await boldBtn.click()
  await page.waitForTimeout(500)
  await canvas.waitForRender()

  const bold = await getNodeById(page, nodeId)
  expect(bold?.fontWeight).toBe(700)

  await boldBtn.click()
  await page.waitForTimeout(500)
  await canvas.waitForRender()

  const normal = await getNodeById(page, nodeId)
  expect(normal?.fontWeight).toBe(400)
  canvas.assertNoErrors()
})

test('Cmd+I toggles italic', async () => {
  await canvas.click(275, 215)
  await canvas.waitForRender()
  const nodeId = expectDefined(await getSelectedNode(page), 'selected text node').id

  await canvas.dblclick(275, 215)
  await expect.poll(() => getEditingTextId(page), { timeout: 5000 }).toBeTruthy()

  await page.keyboard.press('End')
  await page.keyboard.press('Meta+i')
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const node = await getNodeById(page, nodeId)
  expect(node?.italic).toBe(true)
  canvas.assertNoErrors()
})

test('double-click word select changes canvas screenshot', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const baseline = await canvas.screenshotCanvas()

  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const selected = await canvas.screenshotCanvas()

  expect(Buffer.compare(baseline, selected)).not.toBe(0)
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  canvas.assertNoErrors()
})

test('Alt+ArrowRight word navigation stays in text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  await page.keyboard.press('Alt+ArrowRight')
  await canvas.waitForRender()

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})
