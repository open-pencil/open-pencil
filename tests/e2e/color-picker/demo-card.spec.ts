import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '@playwright/test'

async function dragSlider(
  page: Parameters<typeof test>[0]['page'],
  canvas: CanvasHelper,
  testId: string,
  ratio: number
) {
  const slider = page.locator(`[data-test-id="${testId}"] input[type="range"]`)
  const box = await slider.boundingBox()
  if (!box) throw new Error(`Missing slider: ${testId}`)
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 2, y)
  await page.mouse.down()
  await page.mouse.move(box.x + Math.max(2, Math.min(box.width - 2, box.width * ratio)), y, {
    steps: 8
  })
  await page.mouse.up()
  await canvas.waitForRender()
}

async function selectDemoCard(page: Parameters<typeof test>[0]['page'], canvas: CanvasHelper) {
  await page.goto('/demo')
  await canvas.waitForInit()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const nodes = Array.from(store.graph.nodes.values())
    const card =
      nodes.find((node) => node.name === 'Card' && node.type === 'COMPONENT') ??
      nodes.find((node) => node.name === 'Card')
    if (!card)
      throw new Error(
        `Card not found. Available: ${nodes
          .slice(0, 20)
          .map((n) => `${n.name}:${n.type}`)
          .join(', ')}`
      )
    store.state.selectedIds = new Set([card.id])
    store.requestRender()
  })
  await canvas.waitForRender()

  await expect(page.locator('[data-test-id="design-panel-single"]')).toBeVisible()
  await expect(page.locator('[data-test-id="design-node-header"]')).toContainText('Card')
}

async function getSelectedFill(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    const id = [...store.state.selectedIds][0]
    const node = store.graph.getNode(id)
    return node
      ? {
          id: node.id,
          name: node.name,
          type: node.type,
          fill: node.fills?.[0] ?? null
        }
      : null
  })
}

test('demo card fill changes through color picker', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await selectDemoCard(page, canvas)

  const before = await getSelectedFill(page)

  await page.locator('[data-test-id="fill-picker-swatch"]').first().click()
  await expect(page.locator('[data-test-id="fill-picker-tab-solid"]')).toBeVisible()

  await dragSlider(page, canvas, 'color-slider-hue', 0.7)

  const after = await getSelectedFill(page)

  expect(after).not.toBeNull()
  expect(
    before?.fill?.color.r !== after?.fill?.color.r ||
      before?.fill?.color.g !== after?.fill?.color.g ||
      before?.fill?.color.b !== after?.fill?.color.b
  ).toBe(true)
})

test('demo card fill changes from hsb saturation and brightness sliders', async ({ page }) => {
  test.setTimeout(30_000)
  const canvas = new CanvasHelper(page)
  await selectDemoCard(page, canvas)

  await page.locator('[data-test-id="fill-picker-swatch"]').first().click()
  await expect(page.locator('[data-test-id="fill-picker-tab-solid"]')).toBeVisible()
  await canvas.waitForRender()
  await page.locator('[data-test-id="color-format-select"]').click()
  await page.getByRole('option', { name: 'HSB', exact: true }).click()
  await canvas.waitForRender()

  const beforeS = await getSelectedFill(page)
  await dragSlider(page, canvas, 'color-slider-hsb-s', 0.5)
  const afterS = await getSelectedFill(page)

  expect(afterS).not.toBeNull()
  expect(
    beforeS?.fill?.color.r !== afterS?.fill?.color.r ||
      beforeS?.fill?.color.g !== afterS?.fill?.color.g ||
      beforeS?.fill?.color.b !== afterS?.fill?.color.b
  ).toBe(true)

  const beforeB = await getSelectedFill(page)
  await dragSlider(page, canvas, 'color-slider-hsb-b', 0.25)
  const afterB = await getSelectedFill(page)

  expect(afterB).not.toBeNull()
  expect(
    beforeB?.fill?.color.r !== afterB?.fill?.color.r ||
      beforeB?.fill?.color.g !== afterB?.fill?.color.g ||
      beforeB?.fill?.color.b !== afterB?.fill?.color.b
  ).toBe(true)
})
