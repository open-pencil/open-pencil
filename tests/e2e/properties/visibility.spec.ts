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

function getSelectedNode() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      fills: n.fills,
      strokes: n.strokes,
      visible: n.visible
    }
  })
}

test('fill visibility supports repeat click and undo redo', async () => {
  await canvas.drawRect(120, 120, 120, 80)
  await canvas.waitForRender()

  const fillButton = page.getByTestId('fill-visibility-0')
  await expect(fillButton).toBeVisible()
  expect(expectDefined(await getSelectedNode(), 'selected node').fills[0]?.visible).toBe(true)

  await fillButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').fills[0]?.visible).toBe(false)

  await fillButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').fills[0]?.visible).toBe(true)

  await canvas.undo()
  expect(expectDefined(await getSelectedNode(), 'selected node').fills[0]?.visible).toBe(false)

  await canvas.redo()
  expect(expectDefined(await getSelectedNode(), 'selected node').fills[0]?.visible).toBe(true)
})

test('stroke visibility supports repeat click and undo redo', async () => {
  await page.getByTestId('stroke-section-add').click()
  await canvas.waitForRender()

  const strokeButton = page.getByTestId('stroke-visibility-0')
  await expect(strokeButton).toBeVisible()
  expect(expectDefined(await getSelectedNode(), 'selected node').strokes[0]?.visible).toBe(true)

  await strokeButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').strokes[0]?.visible).toBe(false)

  await strokeButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').strokes[0]?.visible).toBe(true)

  await canvas.undo()
  expect(expectDefined(await getSelectedNode(), 'selected node').strokes[0]?.visible).toBe(false)

  await canvas.redo()
  expect(expectDefined(await getSelectedNode(), 'selected node').strokes[0]?.visible).toBe(true)
})

test('appearance visibility supports repeat click and undo redo in one step', async () => {
  const visibilityButton = page.getByTestId('appearance-visibility')
  await expect(visibilityButton).toBeVisible()
  expect(expectDefined(await getSelectedNode(), 'selected node').visible).toBe(true)

  await visibilityButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').visible).toBe(false)

  await visibilityButton.click()
  await canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(), 'selected node').visible).toBe(true)

  await canvas.undo()
  expect(expectDefined(await getSelectedNode(), 'selected node').visible).toBe(false)

  await canvas.undo()
  expect(expectDefined(await getSelectedNode(), 'selected node').visible).toBe(true)
})
