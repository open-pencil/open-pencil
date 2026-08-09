import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

test.beforeEach(async ({ page }) => {
  await page.goto('/editor?new=design&test&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

async function createConstrainedChildren(page: Parameters<typeof propertySection>[0]) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Constraint frame',
      x: 100,
      y: 100,
      width: 100,
      height: 100
    })
    const first = store.graph.createNode('RECTANGLE', frame.id, {
      name: 'First child',
      x: 10,
      y: 10,
      width: 20,
      height: 20
    })
    const second = store.graph.createNode('RECTANGLE', frame.id, {
      name: 'Second child',
      x: 70,
      y: 70,
      width: 20,
      height: 20,
      horizontalConstraint: 'MAX'
    })
    store.select([first.id])
    return { frameId: frame.id, firstId: first.id, secondId: second.id }
  })
}

test('shows constraints only for eligible frame children', async ({ page }) => {
  const ids = await createConstrainedChildren(page)
  const section = propertySection(page, 'Constraints')
  await expect(section).toBeVisible()

  await page.evaluate((frameId) => window.openPencil?.getStore?.()?.select([frameId]), ids.frameId)
  await expect(section).toBeHidden()
})

test('pin diagram and selects update constraint state', async ({ page }) => {
  const ids = await createConstrainedChildren(page)
  const section = propertySection(page, 'Constraints')
  const left = section.getByRole('button', { name: 'Left', exact: true })
  const right = section.getByRole('button', { name: 'Right', exact: true })
  await expect(left).toHaveAttribute('aria-pressed', 'true')

  await right.click()
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.openPencil?.getStore?.()?.graph.getNode(id)?.horizontalConstraint,
        ids.firstId
      )
    )
    .toBe('MAX')

  await left.click({ modifiers: ['Shift'] })
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.openPencil?.getStore?.()?.graph.getNode(id)?.horizontalConstraint,
        ids.firstId
      )
    )
    .toBe('STRETCH')

  await section.getByRole('combobox', { name: 'Horizontal constraint' }).click()
  await page.getByRole('option', { name: 'Scale', exact: true }).click()
  await expect
    .poll(() =>
      page.evaluate(
        (id) => window.openPencil?.getStore?.()?.graph.getNode(id)?.horizontalConstraint,
        ids.firstId
      )
    )
    .toBe('SCALE')
})

test('multi-selection constraint changes undo in one step', async ({ page }) => {
  const ids = await createConstrainedChildren(page)
  await page.evaluate(
    ({ firstId, secondId }) => window.openPencil?.getStore?.()?.select([firstId, secondId]),
    ids
  )
  const section = propertySection(page, 'Constraints')
  const horizontal = section.getByRole('combobox', { name: 'Horizontal constraint' })
  await expect(horizontal).toContainText('Mixed')
  await horizontal.click()
  await page.getByRole('option', { name: 'Center', exact: true }).click()

  await expect
    .poll(() =>
      page.evaluate(({ firstId, secondId }) => {
        const graph = window.openPencil?.getStore?.()?.graph
        return [
          graph?.getNode(firstId)?.horizontalConstraint,
          graph?.getNode(secondId)?.horizontalConstraint
        ]
      }, ids)
    )
    .toEqual(['CENTER', 'CENTER'])

  await page.keyboard.press('Meta+z')
  await expect
    .poll(() =>
      page.evaluate(({ firstId, secondId }) => {
        const graph = window.openPencil?.getStore?.()?.graph
        return [
          graph?.getNode(firstId)?.horizontalConstraint,
          graph?.getNode(secondId)?.horizontalConstraint
        ]
      }, ids)
    )
    .toEqual(['MIN', 'MAX'])
})

test('resizing a frame applies child constraints', async ({ page }) => {
  const ids = await createConstrainedChildren(page)
  await page.evaluate((frameId) => window.openPencil?.getStore?.()?.select([frameId]), ids.frameId)
  const canvas = new CanvasHelper(page)
  await canvas.waitForRender()

  const handle = await page.evaluate((frameId) => {
    const store = window.openPencil?.getStore?.()
    const frame = store?.graph.getNode(frameId)
    if (!store || !frame) throw new Error('Frame not found')
    const position = store.graph.getAbsolutePosition(frameId)
    return {
      x: (position.x + frame.width) * store.state.zoom + store.state.panX,
      y: (position.y + frame.height) * store.state.zoom + store.state.panY
    }
  }, ids.frameId)
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('Canvas not found')

  await page.mouse.move(box.x + handle.x, box.y + handle.y)
  await page.mouse.down()
  await page.mouse.move(box.x + handle.x + 100, box.y + handle.y, { steps: 8 })
  await page.mouse.up()
  await canvas.waitForRender()

  await expect
    .poll(() =>
      page.evaluate((id) => window.openPencil?.getStore?.()?.graph.getNode(id)?.x, ids.secondId)
    )
    .toBeGreaterThan(150)
})
