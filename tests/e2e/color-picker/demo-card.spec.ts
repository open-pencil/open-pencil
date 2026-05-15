import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

async function dragSlider(
  page: Parameters<typeof test>[0]['page'],
  canvas: CanvasHelper,
  testId: string,
  ratio: number
) {
  const slider = page.getByTestId(testId).locator('input[type="range"]')
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
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
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
    store.select([card.id])
  })
  await canvas.waitForRender()

  await expect(page.getByTestId('design-panel-single')).toBeVisible()
  await expect(page.getByTestId('design-node-header')).toContainText('Card')
}

async function getSelectedFill(page: Parameters<typeof test>[0]['page']) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
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

async function getSelectedFillOrThrow(page: Parameters<typeof test>[0]['page']) {
  const selectedFill = await getSelectedFill(page)
  if (!selectedFill?.fill?.color) throw new Error('Selected node has no color fill')
  return selectedFill
}

function expectFillColorChanged(
  before: Awaited<ReturnType<typeof getSelectedFillOrThrow>>,
  after: Awaited<ReturnType<typeof getSelectedFillOrThrow>>
) {
  expect([
    before.fill.color.r !== after.fill.color.r,
    before.fill.color.g !== after.fill.color.g,
    before.fill.color.b !== after.fill.color.b
  ]).toContain(true)
}

test('demo card fill changes through color picker', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await selectDemoCard(page, canvas)

  const before = await getSelectedFillOrThrow(page)

  await page.getByTestId('fill-picker-swatch').first().click()
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeVisible()

  await dragSlider(page, canvas, 'color-slider-hue', 0.7)

  const after = await getSelectedFillOrThrow(page)

  expectFillColorChanged(before, after)
})

test('demo card fill changes from hsb saturation and brightness sliders', async ({ page }) => {
  test.setTimeout(30_000)
  const canvas = new CanvasHelper(page)
  await selectDemoCard(page, canvas)

  await page.getByTestId('fill-picker-swatch').first().click()
  await expect(page.getByTestId('fill-picker-tab-solid')).toBeVisible()
  await canvas.waitForRender()
  await page.getByTestId('color-format-select').click()
  await page.getByRole('option', { name: 'HSB', exact: true }).click()
  await canvas.waitForRender()

  const beforeS = await getSelectedFillOrThrow(page)
  await dragSlider(page, canvas, 'color-slider-hsb-s', 0.5)
  const afterS = await getSelectedFillOrThrow(page)

  expectFillColorChanged(beforeS, afterS)

  const beforeB = await getSelectedFillOrThrow(page)
  await dragSlider(page, canvas, 'color-slider-hsb-b', 0.25)
  const afterB = await getSelectedFillOrThrow(page)

  expectFillColorChanged(beforeB, afterB)
})
