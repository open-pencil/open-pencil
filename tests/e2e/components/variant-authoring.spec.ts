import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { selectNode } from '#tests/helpers/components/properties'
import { propertySection } from '#tests/helpers/properties'

test('authors multiple variant dimensions and reports duplicate combinations', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const componentSet = store.graph.createNode('COMPONENT_SET', pageId, {
      name: 'Button',
      componentPropertyDefinitions: [
        {
          id: '50:1',
          name: 'Variant',
          type: 'VARIANT',
          defaultValue: 'Primary',
          variantOptions: ['Primary', 'Secondary']
        },
        {
          id: '50:2',
          name: 'Property 2',
          type: 'VARIANT',
          defaultValue: 'Small',
          variantOptions: ['Small', 'Large']
        }
      ]
    })
    const primarySmall = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Primary, Property 2=Small',
      componentPropertyValues: { Variant: 'Primary', 'Property 2': 'Small' }
    })
    const primaryLarge = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Primary, Property 2=Large',
      x: 160,
      componentPropertyValues: { Variant: 'Primary', 'Property 2': 'Large' }
    })
    const secondarySmall = store.graph.createNode('COMPONENT', componentSet.id, {
      name: 'Variant=Secondary, Property 2=Small',
      y: 120,
      componentPropertyValues: { Variant: 'Secondary', 'Property 2': 'Small' }
    })
    store.select([componentSet.id])
    return {
      componentSetId: componentSet.id,
      primarySmallId: primarySmall.id,
      primaryLargeId: primaryLarge.id,
      secondarySmallId: secondarySmall.id
    }
  })
  await canvas.waitForRender()

  // The set's variant properties are rows of the Properties list; each opens to rename it.
  const properties = propertySection(page, 'Properties')
  async function renameProperty(from: string, to: string) {
    await properties.getByRole('button', { name: new RegExp(`^${from}`) }).click()
    const name = page.getByRole('dialog', { name: from }).getByRole('textbox', { name: 'Name' })
    await name.fill(to)
    await name.press('Enter')
    await page.keyboard.press('Escape')
    await canvas.waitForRender()
  }
  await renameProperty('Variant', 'Type')
  await renameProperty('Property 2', 'Size')

  // The section's + adds a variant property named Property 1 with the value Default.
  await properties.getByRole('button', { name: 'Create property…' }).click()
  await page.getByRole('menuitem', { name: 'Variant', exact: true }).click()
  await canvas.waitForRender()
  await renameProperty('Property 1', 'State')

  const definitions = await page.evaluate((componentSetId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(componentSetId)?.componentPropertyDefinitions
  }, ids.componentSetId)
  expect(definitions?.map((definition) => definition.name)).toEqual(['Type', 'Size', 'State'])

  await page.evaluate((variantId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select([variantId])
  }, ids.primaryLargeId)
  await canvas.waitForRender()

  const variantSection = propertySection(page, 'Variants')
  await expect(variantSection.getByRole('textbox', { name: 'Type' })).toHaveValue('Primary')
  await expect(variantSection.getByRole('textbox', { name: 'Size' })).toHaveValue('Large')
  await expect(variantSection.getByRole('textbox', { name: 'State' })).toHaveValue('Default')
  await variantSection.getByRole('textbox', { name: 'Size' }).fill('Small')
  await variantSection.getByRole('textbox', { name: 'Size' }).blur()
  await expect(variantSection.getByRole('alert')).toContainText('Duplicate variant values')
  await expect(variantSection.getByRole('textbox', { name: 'Size' })).toHaveValue('Large')

  const state = await page.evaluate((variantId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(variantId)
    return node
      ? { name: node.name, values: node.componentPropertyValues, undoLabel: store.undo.undoLabel }
      : null
  }, ids.primaryLargeId)
  expect(state).toEqual({
    name: 'Type=Primary, Size=Large, State=Default',
    values: { Type: 'Primary', Size: 'Large', State: 'Default' },
    undoLabel: 'Rename property'
  })

  await variantSection.getByRole('textbox', { name: 'Size' }).fill('Medium')
  await variantSection.getByRole('textbox', { name: 'Size' }).blur()
  await canvas.waitForRender()
  await expect(variantSection.getByRole('alert')).toHaveCount(0)
  await expect(variantSection.getByRole('textbox', { name: 'Size' })).toHaveValue('Medium')

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  await expect(variantSection.getByRole('alert')).toHaveCount(0)
  await expect(variantSection.getByRole('textbox', { name: 'Size' })).toHaveValue('Large')
})

test('adds a variant to a standalone component the way Figma does', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const chipId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const chip = store.graph.createNode('COMPONENT', store.state.currentPageId, {
      name: 'Chip',
      x: 40,
      y: 40,
      width: 80,
      height: 32
    })
    return chip.id
  })
  await selectNode(page, chipId)
  await canvas.waitForRender()

  await page.getByRole('button', { name: 'Add variant' }).click()
  await canvas.waitForRender()

  const properties = propertySection(page, 'Properties')
  await selectNode(page, await setOf(page, chipId))
  await expect(properties.getByRole('button', { name: /^Property 1/ })).toContainText(
    'Default, Variant2'
  )
  expect(await variantNames(page, chipId)).toEqual(['Property 1=Default', 'Property 1=Variant2'])

  // A value variants use moves them to another value first.
  await properties.getByRole('button', { name: /^Property 1/ }).click()
  const values = page.getByRole('dialog', { name: 'Property 1' })
  await values.getByRole('textbox', { name: 'Add value' }).fill('Hover')
  await values.getByRole('textbox', { name: 'Add value' }).press('Enter')
  await values.getByRole('button', { name: 'Remove Variant2' }).click()
  await values.getByRole('combobox', { name: /Move variants with Variant2/ }).click()
  await page.getByRole('option', { name: 'Hover', exact: true }).click()
  await expect
    .poll(() => variantNames(page, chipId))
    .toEqual(['Property 1=Default', 'Property 1=Hover'])
})

async function setOf(page: Page, componentId: string): Promise<string> {
  const id = await page.evaluate(
    (nodeId) => window.openPencil?.getStore?.()?.graph.getNode(nodeId)?.parentId,
    componentId
  )
  if (!id) throw new Error('Expected a component set')
  return id
}

function variantNames(page: Page, componentId: string) {
  return page.evaluate((nodeId) => {
    const graph = window.openPencil?.getStore?.()?.graph
    const setId = graph?.getNode(nodeId)?.parentId
    return setId ? (graph?.getChildren(setId).map((node) => node.name) ?? []) : []
  }, componentId)
}
