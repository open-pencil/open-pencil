import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

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

async function getSelectedNodeFlags() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    if (!id) return null
    const n = store.graph.getNode(id)
    if (!n) return null
    return {
      type: n.type,
      independentCorners: n.independentCorners,
      independentStrokeWeights: n.independentStrokeWeights
    }
  })
}

async function drawFrame(x: number, y: number, w: number, h: number) {
  await canvas.pressKey('f')
  await canvas.drag(x, y, x + w, y + h)
  await canvas.waitForRender()
}

test('independent corners toggle shows per-corner inputs', async () => {
  await drawFrame(120, 120, 120, 80)
  await canvas.waitForRender()

  const flags = await getSelectedNodeFlags()
  expect(flags?.type).toBe('FRAME')
  expect(flags?.independentCorners).toBe(false)

  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await expect(toggle).toBeVisible()

  await toggle.click()
  await canvas.waitForRender()

  expect((await getSelectedNodeFlags())?.independentCorners).toBe(true)
  const grid = page.locator('[data-corner-grid]')
  await expect(grid).toBeVisible()
  const cornerInputs = grid.getByRole('spinbutton')
  expect(await cornerInputs.count()).toBe(4)

  await toggle.click()
  await canvas.waitForRender()
  await expect(grid).not.toBeVisible()
})

test('multi-selection independent corners toggle is one undo step', async () => {
  await canvas.clearCanvas()
  await drawFrame(80, 80, 100, 70)
  await drawFrame(240, 80, 100, 70)
  await canvas.pressKey('Meta+a')
  await canvas.waitForRender()

  const independentStates = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return [...store.state.selectedIds].map(
        (id) => store.graph.getNode(id)?.independentCorners ?? null
      )
    })

  const toggle = propertySection(page, 'Appearance').getByRole('button', {
    name: 'Independent corner radii'
  })
  await toggle.click()
  await canvas.waitForRender()
  expect(await independentStates()).toEqual([true, true])

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await independentStates()).toEqual([false, false])
})

test('stroke sides toggle shows per-side weight inputs', async () => {
  await drawFrame(300, 50, 120, 80)
  await canvas.waitForRender()

  const addStroke = page.getByTestId('stroke-section-add')
  await expect(addStroke).toBeVisible()
  await addStroke.click()
  await canvas.waitForRender()

  const toggle = page.getByTestId('stroke-sides-toggle')
  await expect(toggle).toBeVisible({ timeout: 5000 })

  const sectionInputsBefore = await page
    .getByTestId('stroke-section')
    .getByRole('spinbutton')
    .count()

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsAfter = await page
    .getByTestId('stroke-section')
    .getByRole('spinbutton')
    .count()
  expect(sectionInputsAfter).toBeGreaterThan(sectionInputsBefore)

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsFinal = await page
    .getByTestId('stroke-section')
    .getByRole('spinbutton')
    .count()
  expect(sectionInputsFinal).toBe(sectionInputsBefore)
})
