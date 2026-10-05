import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
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

  const section = propertySection(page, 'Variants')
  await expect(section).toBeVisible()
  const propertyRows = section.locator('[data-property]')
  await expect(propertyRows).toHaveCount(2)
  await propertyRows.nth(0).getByRole('textbox', { name: 'Property name' }).fill('Type')
  await propertyRows.nth(0).getByRole('textbox', { name: 'Property name' }).blur()
  await canvas.waitForRender()
  await propertyRows.nth(1).getByRole('textbox', { name: 'Property name' }).fill('Size')
  await propertyRows.nth(1).getByRole('textbox', { name: 'Property name' }).blur()
  await canvas.waitForRender()

  // The header + adds Property 1 with the value Default and selects its name for typing.
  await section.getByRole('button', { name: 'Add variant property' }).click()
  const added = propertyRows.nth(2).getByRole('textbox', { name: 'Property name' })
  await expect(added).toHaveValue('Property 1')
  await expect(added).toBeFocused()
  await page.keyboard.type('State')
  await added.blur()
  await canvas.waitForRender()

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
