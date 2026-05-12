import { expect, test, type Page } from '@playwright/test'

import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

async function selectedNodeSnapshot(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    const selected = selectedId ? store.graph.getNode(selectedId) : null
    return selected
      ? {
          id: selected.id,
          type: selected.type,
          parentId: selected.parentId,
          componentId: selected.componentId,
          pageId: store.state.currentPageId
        }
      : null
  })
}

test('assets panel groups component sets and inserts the default variant', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')

    const set = store.graph.createNode('COMPONENT_SET', pageNode.id, {
      name: 'Button',
      x: 80,
      y: 80,
      width: 260,
      height: 100,
      componentPropertyDefinitions: [
        {
          id: 'prop:type',
          name: 'Type',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        }
      ]
    })
    const primary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Primary',
      x: 0,
      y: 0,
      width: 96,
      height: 40,
      componentPropertyValues: { Type: 'Primary' }
    })
    const secondary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Secondary',
      x: 120,
      y: 0,
      width: 96,
      height: 40,
      componentPropertyValues: { Type: 'Secondary' }
    })
    const card = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Card',
      x: 80,
      y: 240,
      width: 160,
      height: 100
    })
    store.requestRender()
    return { setId: set.id, primaryId: primary.id, secondaryId: secondary.id, cardId: card.id }
  })
  await canvas.waitForRender()

  await page.locator('[data-test-id="left-panel-assets-tab"]').click()

  const assetsPanel = page.locator('[data-test-id="assets-panel"]')
  const assetItems = page.locator('[data-test-id="asset-item"]')
  await expect(assetItems).toHaveCount(2)
  await expect(assetsPanel).toContainText('Button')
  await expect(assetsPanel).toContainText('Card')
  await expect(assetsPanel).not.toContainText('Type=Primary')
  await expect(assetsPanel).not.toContainText('Type=Secondary')
  await expect(
    page.locator(`[data-asset-id="${ids.setId}"] [data-test-id="asset-variant-summary"]`)
  ).toContainText('Type')

  await page.locator('[data-test-id="assets-search"]').fill('card')
  await expect(assetItems).toHaveCount(1)
  await expect(assetsPanel).toContainText('Card')
  await page.locator(`[data-asset-id="${ids.cardId}"] [data-test-id="asset-insert"]`).click()
  await canvas.waitForRender()

  const cardInstance = await selectedNodeSnapshot(page)
  expect(cardInstance?.type).toBe('INSTANCE')
  expect(cardInstance?.componentId).toBe(ids.cardId)

  await page.locator('[data-test-id="assets-search"]').fill('missing asset')
  await expect(page.locator('[data-test-id="assets-empty"]')).toBeVisible()
  await expect(assetItems).toHaveCount(0)

  await page.locator('[data-test-id="assets-search"]').fill('button')
  await expect(assetItems).toHaveCount(1)
  await page.locator(`[data-asset-id="${ids.setId}"] [data-test-id="asset-insert"]`).click()
  await canvas.waitForRender()

  const inserted = await selectedNodeSnapshot(page)

  expect(inserted?.type).toBe('INSTANCE')
  expect(inserted?.componentId).toBe(ids.primaryId)
  expect(inserted?.parentId).toBe(inserted?.pageId)

  await expect(page.locator('[data-test-id="variant-section"]')).toBeVisible()

  await page.locator('[data-test-id="variant-section"] [data-test-id="app-select-trigger"]').click()
  await page.getByRole('option', { name: 'Secondary' }).click()

  const switchedComponentId = await page.evaluate(
    (instanceId) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return store.graph.getNode(instanceId)?.componentId
    },
    expectDefined(inserted?.id, 'inserted instance id')
  )
  expect(switchedComponentId).toBe(ids.secondaryId)

  canvas.assertNoErrors()
})

test('demo exposes component set assets', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/demo')
  await canvas.waitForInit()

  await page.locator('[data-test-id="left-panel-assets-tab"]').click()
  const assetsPanel = page.locator('[data-test-id="assets-panel"]')

  await expect(assetsPanel).toContainText('Button')
  await expect(assetsPanel).toContainText('2 variants · Variant')
  await expect(assetsPanel).toContainText('Avatar')
  await expect(assetsPanel).not.toContainText('Button/Primary')

  canvas.assertNoErrors()
})
