import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/editor')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

async function reset() {
  await canvas.clearCanvas()
  await canvas.waitForRender()
}

test('single rectangle panel', async () => {
  await reset()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Card',
      x: 100,
      y: 100,
      width: 180,
      height: 120,
      cornerRadius: 16
    })
    store.select([node.id])
  })
  await canvas.waitForRender()
  await expect(page.getByTestId('design-panel-single')).toHaveScreenshot('single-rectangle.png')
})

test('text selection panel', async () => {
  await reset()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Heading',
      text: 'Panel typography',
      x: 100,
      y: 100,
      width: 240,
      height: 80,
      fontSize: 24
    })
    store.select([node.id])
  })
  await canvas.waitForRender()
  await expect(page.getByTestId('design-panel-single')).toHaveScreenshot('text-selection.png')
})

test('mixed selection panel', async () => {
  await reset()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const first = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      x: 100,
      y: 100,
      width: 120,
      height: 80
    })
    const second = store.graph.createNode('ELLIPSE', store.state.currentPageId, {
      x: 260,
      y: 100,
      width: 100,
      height: 100
    })
    store.select([first.id, second.id])
  })
  await canvas.waitForRender()
  await expect(page.getByTestId('design-panel-multi')).toHaveScreenshot('mixed-selection.png')
})

test('instance panel', async () => {
  await reset()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const component = store.graph.createNode('COMPONENT', store.state.currentPageId, {
      name: 'Button',
      componentPropertyDefinitions: [
        { id: '40:1', name: 'Label', type: 'TEXT', defaultValue: 'Button' },
        { id: '40:2', name: 'Enabled', type: 'BOOLEAN', defaultValue: 'true' }
      ]
    })
    store.graph.createNode('TEXT', component.id, {
      name: 'Label',
      text: 'Button',
      componentPropertyReferences: [{ propertyId: '40:1', field: 'TEXT' }]
    })
    store.graph.createNode('FRAME', component.id, {
      name: 'State',
      componentPropertyReferences: [{ propertyId: '40:2', field: 'VISIBLE' }]
    })
    const instance = store.graph.createInstance(component.id, store.state.currentPageId)
    if (!instance) throw new Error('Expected instance')
    store.select([instance.id])
  })
  await canvas.waitForRender()
  await expect(page.getByTestId('design-panel-single')).toHaveScreenshot('instance.png')
})

test('empty canvas panel', async () => {
  await reset()
  await expect(page.getByTestId('design-panel-empty')).toHaveScreenshot('empty-canvas.png')
})

test('nested groups layer tree', async () => {
  await reset()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const outer = store.graph.createNode('GROUP', store.state.currentPageId, {
      name: 'Outer group',
      expanded: true
    })
    const inner = store.graph.createNode('GROUP', outer.id, {
      name: 'Inner group',
      expanded: true
    })
    store.graph.createNode('RECTANGLE', inner.id, { name: 'Nested rectangle' })
    store.select([inner.id])
  })
  await canvas.waitForRender()
  await page
    .getByTestId('layers-item')
    .filter({ hasText: 'Inner group' })
    .locator('[data-slot="disclosure"]')
    .click()
  await expect(page.getByTestId('layers-panel')).toHaveScreenshot('nested-groups-layer-tree.png')
})
