import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper
let instanceId = ''

async function selectOption(label: string, option: string) {
  const section = propertySection(page, 'Component properties')
  await section.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await canvas.waitForRender()
}

async function instanceState(id = instanceId) {
  return page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const instance = store.graph.getNode(nodeId)
    if (!instance) return null
    const children = store.graph.getChildren(nodeId)
    return {
      componentId: instance.componentId,
      assignments: instance.componentPropertyAssignments,
      label: children.find((node) => node.name === 'Label')?.text,
      badgeVisible: children.find((node) => node.name === 'Badge')?.visible,
      iconName: children.find((node) => node.type === 'INSTANCE')?.name
    }
  }, id)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/editor')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  instanceId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const iconA = store.graph.createNode('COMPONENT', pageId, { name: 'Icon A' })
    store.graph.createNode('RECTANGLE', iconA.id, { name: 'A shape' })
    const iconB = store.graph.createNode('COMPONENT', pageId, { name: 'Icon B' })
    store.graph.createNode('ELLIPSE', iconB.id, { name: 'B shape' })
    const componentSet = store.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Card',
      componentPropertyDefinitions: [
        { id: '30:1', name: 'State', type: 'VARIANT', defaultValue: 'Default' },
        { id: '30:2', name: 'Label', type: 'TEXT', defaultValue: 'Default label' },
        { id: '30:3', name: 'Show badge', type: 'BOOLEAN', defaultValue: 'true' },
        { id: '30:4', name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: iconA.id }
      ]
    })
    const createVariant = (name: string, state: string, x: number) => {
      const component = store.graph.createNode('COMPONENT', componentSet.id, {
        name,
        x,
        width: 220,
        height: 100,
        componentPropertyValues: { State: state }
      })
      store.graph.createNode('TEXT', component.id, {
        name: 'Label',
        text: `${state} label`,
        componentPropertyReferences: [{ propertyId: '30:2', field: 'TEXT' }]
      })
      store.graph.createNode('FRAME', component.id, {
        name: 'Badge',
        componentPropertyReferences: [{ propertyId: '30:3', field: 'VISIBLE' }]
      })
      const icon = store.graph.createInstance(iconA.id, component.id, { name: 'Icon' })
      if (!icon) throw new Error('Expected nested icon')
      store.graph.updateNode(icon.id, {
        componentPropertyReferences: [{ propertyId: '30:4', field: 'INSTANCE_SWAP' }]
      })
      return component
    }
    const primary = createVariant('Default card', 'Default', 0)
    createVariant('Hover card', 'Hover', 260)
    const instance = store.graph.createInstance(primary.id, pageId, { x: 200, y: 300 })
    if (!instance) throw new Error('Expected instance')
    store.select([instance.id])
    return instance.id
  })
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('renders and applies all component property control types', async () => {
  const section = propertySection(page, 'Component properties')
  await expect(section).toBeVisible()
  await expect(section.getByRole('combobox', { name: 'State' })).toBeVisible()
  await expect(section.getByRole('textbox', { name: 'Label' })).toBeVisible()
  await expect(section.getByRole('switch', { name: 'Show badge' })).toBeVisible()
  await expect(section.getByRole('combobox', { name: 'Icon' })).toBeVisible()

  const text = section.getByRole('textbox', { name: 'Label' })
  await text.fill('Custom label')
  await text.blur()
  await canvas.waitForRender()
  expect(await instanceState()).toMatchObject({ label: 'Custom label' })

  await section.getByRole('switch', { name: 'Show badge' }).click()
  await canvas.waitForRender()
  expect(await instanceState()).toMatchObject({ badgeVisible: false })

  await selectOption('Icon', 'Icon B')
  expect(await instanceState()).toMatchObject({ iconName: 'Icon B' })

  await selectOption('State', 'Hover')
  expect(await instanceState()).toMatchObject({ label: 'Custom label' })
  await expect(section).toHaveScreenshot('component-properties-controls.png')
})

test('batches compatible mixed selection and undo', async () => {
  const secondId = await page.evaluate((firstId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const first = store.graph.getNode(firstId)
    if (!first?.componentId) throw new Error('Missing first instance')
    const second = store.graph.createInstance(first.componentId, store.state.currentPageId, {
      x: 500,
      y: 300
    })
    if (!second) throw new Error('Expected second instance')
    store.select([firstId, second.id])
    return second.id
  }, instanceId)
  await canvas.waitForRender()
  const toggle = propertySection(page, 'Component properties').getByRole('switch', {
    name: 'Show badge'
  })
  await expect(toggle).toHaveAttribute('data-mixed', 'true')
  await toggle.click()
  await canvas.waitForRender()
  expect(await instanceState(instanceId)).toMatchObject({ badgeVisible: true })
  expect(await instanceState(secondId)).toMatchObject({ badgeVisible: true })

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await instanceState(instanceId)).toMatchObject({ badgeVisible: false })
  expect(await instanceState(secondId)).toMatchObject({ badgeVisible: true })

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const rectangle = store.graph.createNode('RECTANGLE', store.state.currentPageId)
    store.select([id, rectangle.id])
  }, instanceId)
  await canvas.waitForRender()
  await expect(propertySection(page, 'Component properties')).toHaveCount(0)
})
