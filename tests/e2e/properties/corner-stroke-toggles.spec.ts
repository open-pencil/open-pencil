import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test, type Page } from '@playwright/test'

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
    const store = window.__OPEN_PENCIL_STORE__!
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
  expect(flags!.type).toBe('FRAME')
  expect(flags!.independentCorners).toBe(false)

  const toggle = page.locator('[data-test-id="independent-corners-toggle"]')
  await expect(toggle).toBeVisible()

  await toggle.click()
  await canvas.waitForRender()

  expect((await getSelectedNodeFlags())!.independentCorners).toBe(true)
  const grid = page.locator('[data-test-id="independent-corners-grid"]')
  await expect(grid).toBeVisible()
  const cornerInputs = grid.locator('[data-test-id="scrub-input"]')
  expect(await cornerInputs.count()).toBe(4)

  await toggle.click()
  await canvas.waitForRender()
  await expect(grid).not.toBeVisible()
})

test('stroke sides toggle shows per-side weight inputs', async () => {
  await drawFrame(300, 50, 120, 80)
  await canvas.waitForRender()

  const addStroke = page.locator('[data-test-id="stroke-section-add"]')
  await expect(addStroke).toBeVisible()
  await addStroke.click()
  await canvas.waitForRender()

  const toggle = page.locator('[data-test-id="stroke-sides-toggle"]')
  await expect(toggle).toBeVisible({ timeout: 5000 })

  const sectionInputsBefore = await page
    .locator('[data-test-id="stroke-section"] [data-test-id="scrub-input"]')
    .count()

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsAfter = await page
    .locator('[data-test-id="stroke-section"] [data-test-id="scrub-input"]')
    .count()
  expect(sectionInputsAfter).toBeGreaterThan(sectionInputsBefore)

  await toggle.click()
  await canvas.waitForRender()

  const sectionInputsFinal = await page
    .locator('[data-test-id="stroke-section"] [data-test-id="scrub-input"]')
    .count()
  expect(sectionInputsFinal).toBe(sectionInputsBefore)
})
