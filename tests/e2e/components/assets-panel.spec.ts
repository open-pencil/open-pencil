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
          pageId: store.state.currentPageId,
          width: selected.width,
          childTexts: store.graph
            .getChildren(selected.id)
            .filter((child) => child.type === 'TEXT')
            .map((child) => child.text)
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
      sourceLibraryKey: 'lk-test-library',
      symbolDescription: 'Reusable button component',
      symbolLinks: [{ uri: 'https://example.com/button', displayName: 'Button docs' }],
      componentPropertyDefinitions: [
        {
          id: 'prop:type',
          name: 'Type',
          type: 'VARIANT',
          defaultValue: 'Secondary',
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
    store.graph.createNode('TEXT', primary.id, {
      name: 'Label',
      text: 'Primary',
      width: 72,
      height: 20
    })
    const secondary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Secondary',
      x: 120,
      y: 0,
      width: 132,
      height: 40,
      componentPropertyValues: { Type: 'Secondary' }
    })
    store.graph.createNode('TEXT', secondary.id, {
      name: 'Label',
      text: 'Secondary',
      width: 96,
      height: 20
    })
    const duplicateSecondary = store.graph.createNode('COMPONENT', set.id, {
      name: 'Type=Secondary duplicate',
      x: 280,
      y: 0,
      width: 132,
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
    return {
      setId: set.id,
      primaryId: primary.id,
      secondaryId: secondary.id,
      duplicateSecondaryId: duplicateSecondary.id,
      cardId: card.id
    }
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
  const buttonAsset = page.locator(`[data-asset-id="${ids.setId}"]`)
  await expect(buttonAsset.locator('[data-test-id="asset-variant-summary"]')).toContainText('Type')
  await expect(buttonAsset.locator('[data-test-id="asset-library-badge"]')).toContainText('Library')
  await expect(buttonAsset.locator('[data-test-id="asset-description"]')).toContainText(
    'Reusable button component'
  )
  await expect(buttonAsset.locator('[data-test-id="asset-docs"]')).toBeVisible()
  await expect(buttonAsset.locator('[data-test-id="asset-variant-conflict"]')).toContainText(
    'Duplicate variant values'
  )

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
  expect(inserted?.componentId).toBe(ids.secondaryId)
  expect(inserted?.parentId).toBe(inserted?.pageId)
  expect(inserted?.width).toBe(132)
  expect(inserted?.childTexts).toEqual(['Secondary'])

  await expect(page.locator('[data-test-id="variant-section"]')).toBeVisible()

  await page.locator('[data-test-id="variant-section"] [data-test-id="app-select-trigger"]').click()
  await page.getByRole('option', { name: 'Primary' }).click()

  expectDefined(inserted?.id, 'inserted instance id')
  const switched = await selectedNodeSnapshot(page)
  expect(switched?.componentId).toBe(ids.primaryId)
  expect(switched?.width).toBe(96)
  expect(switched?.childTexts).toEqual(['Primary'])

  canvas.assertNoErrors()
})

test('assets insertion accounts for entered container coordinates', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  const setup = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error('Current page not found')
    const frame = store.graph.createNode('FRAME', pageNode.id, {
      name: 'Target Frame',
      x: 200,
      y: 150,
      width: 300,
      height: 240
    })
    const component = store.graph.createNode('COMPONENT', pageNode.id, {
      name: 'Panel Card',
      x: 40,
      y: 40,
      width: 120,
      height: 60
    })
    store.state.enteredContainerId = frame.id
    store.requestRender()
    return { frameId: frame.id, componentId: component.id }
  })
  await canvas.waitForRender()

  await page.locator('[data-test-id="left-panel-assets-tab"]').click()
  await page.locator(`[data-asset-id="${setup.componentId}"] [data-test-id="asset-insert"]`).click()
  await canvas.waitForRender()

  const inserted = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const selectedId = [...store.state.selectedIds][0]
    const selected = selectedId ? store.graph.getNode(selectedId) : null
    if (!selected) return null
    const abs = store.graph.getAbsolutePosition(selected.id)
    const canvasEl = document.querySelector<HTMLElement>('[data-test-id="canvas-area"]')
    const rect = canvasEl?.getBoundingClientRect()
    const center = store.screenToCanvas(
      (rect?.width ?? window.innerWidth) / 2,
      (rect?.height ?? window.innerHeight) / 2
    )
    return {
      parentId: selected.parentId,
      centerX: abs.x + selected.width / 2,
      centerY: abs.y + selected.height / 2,
      expectedCenterX: center.x,
      expectedCenterY: center.y
    }
  })

  expect(inserted?.parentId).toBe(setup.frameId)
  expect(inserted?.centerX).toBeCloseTo(inserted?.expectedCenterX ?? 0, 1)
  expect(inserted?.centerY).toBeCloseTo(inserted?.expectedCenterY ?? 0, 1)
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
