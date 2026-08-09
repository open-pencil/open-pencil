import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItems, propertySection } from '#tests/helpers/properties'

async function dragSlider(page: Page, canvas: CanvasHelper, testId: string, ratio: number) {
  const slider = page.getByTestId(testId).locator(':scope > [data-orientation="horizontal"]')
  const box = await slider.boundingBox()
  if (!box) throw new Error(`Missing slider: ${testId}`)
  await slider.click({
    position: {
      x: Math.max(2, Math.min(box.width - 2, box.width * ratio)),
      y: box.height / 2
    }
  })
  await canvas.waitForRender()
}

async function openStrokePicker(page: Page) {
  await propertyItems(page, 'strokes')
    .first()
    .getByRole('button', { name: 'Stroke', exact: true })
    .click()
  await expect(page.locator('[data-picker-content]')).toBeVisible()
}

async function chooseFormat(page: Page, label: 'RGB' | 'HSL' | 'HSB' | 'OkHCL') {
  await page.getByTestId('color-format-select').click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function getSelectedStroke(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = store.graph.getNode(id)
    return node?.strokes?.[0] ?? null
  })
}

test('stroke picker updates stroke color on a rectangle', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/editor?new=design')
  await canvas.waitForInit()

  await canvas.drawRect(120, 120, 180, 120)
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()

  const before = await getSelectedStroke(page)
  await openStrokePicker(page)
  await dragSlider(page, canvas, 'color-slider-hue', 0.7)
  const after = await getSelectedStroke(page)

  expect(after).not.toBeNull()
  expect(
    before?.color.r !== after?.color.r ||
      before?.color.g !== after?.color.g ||
      before?.color.b !== after?.color.b
  ).toBe(true)
})

test('stroke picker alpha slider updates stroke opacity and alpha', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/editor?new=design')
  await canvas.waitForInit()

  await canvas.drawRect(120, 120, 180, 120)
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()

  await openStrokePicker(page)
  await dragSlider(page, canvas, 'color-slider-alpha', 0.25)
  const after = await getSelectedStroke(page)

  expect(after).not.toBeNull()
  expect(after?.opacity).toBeLessThan(1)
  expect(after?.color.a).toBeCloseTo(after?.opacity ?? 0, 3)
})

test('stroke picker hsb saturation and brightness sliders update stroke color on demo card', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo')
  await canvas.waitForInit()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const nodes = Array.from(store.graph.nodes.values())
    const card =
      nodes.find((node) => node.name === 'Card' && node.type === 'COMPONENT') ??
      nodes.find((node) => node.name === 'Card')
    if (!card) throw new Error('Card not found')
    const stroke = {
      color: { r: 0.9, g: 0.9, b: 0.92, a: 1 },
      weight: 1,
      opacity: 1,
      visible: true,
      align: 'INSIDE'
    }
    store.updateNodeWithUndo(card.id, { strokes: [stroke] }, 'Add demo card stroke')
    store.select([card.id])
  })
  await canvas.waitForRender()

  await expect(propertyItems(page, 'strokes')).toBeVisible()
  await openStrokePicker(page)
  await chooseFormat(page, 'HSB')

  const beforeS = await getSelectedStroke(page)
  await dragSlider(page, canvas, 'color-slider-hsb-s', 0.6)
  const afterS = await getSelectedStroke(page)
  expect(afterS).not.toBeNull()
  expect(
    beforeS?.color.r !== afterS?.color.r ||
      beforeS?.color.g !== afterS?.color.g ||
      beforeS?.color.b !== afterS?.color.b
  ).toBe(true)

  const beforeB = await getSelectedStroke(page)
  await dragSlider(page, canvas, 'color-slider-hsb-b', 0.2)
  const afterB = await getSelectedStroke(page)
  expect(afterB).not.toBeNull()
  expect(
    beforeB?.color.r !== afterB?.color.r ||
      beforeB?.color.g !== afterB?.color.g ||
      beforeB?.color.b !== afterB?.color.b
  ).toBe(true)
})

test('bound stroke picker is non-destructive, rolls back Escape, and detaches in one undo step', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/editor?new=design')
  await canvas.waitForInit()
  await canvas.drawRect(120, 120, 180, 120)
  await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await canvas.waitForRender()

  const before = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const collection = store.graph.createCollection('Colors')
    const variable = store.graph.createVariable('stroke-brand', 'COLOR', collection.id, {
      r: 0.9,
      g: 0.1,
      b: 0.2,
      a: 1
    })
    const id = [...store.state.selectedIds][0]
    if (!id) throw new Error('Expected selected node')
    store.graph.bindVariable(id, 'strokes/0/color', variable.id)
    store.state.sceneVersion++
    const node = store.getNode(id)
    return { color: node?.strokes[0]?.color, binding: node?.boundVariables['strokes/0/color'] }
  })
  await canvas.waitForRender()

  await openStrokePicker(page)
  expect(
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const id = [...store.state.selectedIds][0]
      return id ? store.getNode(id)?.boundVariables['strokes/0/color'] : undefined
    })
  ).toBe(before.binding)

  await dragSlider(page, canvas, 'color-slider-hue', 0.55)
  await page.keyboard.press('Escape')
  await canvas.waitForRender()
  const afterEscape = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return { color: node?.strokes[0]?.color, binding: node?.boundVariables['strokes/0/color'] }
  })
  expect(afterEscape).toEqual(before)

  await openStrokePicker(page)
  await dragSlider(page, canvas, 'color-slider-hue', 0.75)
  await propertyItems(page, 'strokes')
    .first()
    .getByRole('button', { name: 'Stroke', exact: true })
    .click()
  await canvas.waitForRender()
  expect((await getSelectedStroke(page))?.color).not.toEqual(before.color)

  await canvas.undo()
  await canvas.waitForRender()
  const restored = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = [...store.state.selectedIds][0]
    const node = id ? store.getNode(id) : null
    return { color: node?.strokes[0]?.color, binding: node?.boundVariables['strokes/0/color'] }
  })
  expect(restored).toEqual(before)
})
