import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import {
  componentPropertyDefinitions,
  createPropertyAuthoringScene,
  nestedInstanceText,
  selectNode,
  type PropertyAuthoringScene
} from '#tests/helpers/components/properties'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper
let ids: PropertyAuthoringScene

async function select(nodeId: string) {
  await selectNode(page, nodeId)
  await canvas.waitForRender()
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  ids = await createPropertyAuthoringScene(page)
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('links a layer field to a new property from the section that owns the field', async () => {
  await select(ids.labelId)
  const typography = propertySection(page, 'Typography')
  await typography.getByRole('button', { name: /Apply component property/ }).click()
  await page.getByRole('menuitem', { name: /Create property/ }).click()

  await expect(typography.getByRole('button', { name: 'Detach property' })).toBeVisible()
  await expect
    .poll(() => componentPropertyDefinitions(page, ids.buttonId))
    .toEqual([{ name: 'Label', type: 'TEXT', defaultValue: 'Button' }])
})

test('edits a property from its row and adds another from the section menu', async () => {
  await select(ids.buttonId)
  const properties = propertySection(page, 'Properties')
  await properties.getByRole('button', { name: /^Label/ }).click()
  const name = page.getByRole('dialog', { name: 'Label' }).getByRole('textbox', { name: 'Name' })
  await name.fill('Caption')
  await name.press('Enter')
  // The popover is named after the property, so it follows the rename.
  const value = page
    .getByRole('dialog', { name: 'Caption' })
    .getByRole('textbox', { name: 'Default value' })
  await value.fill('Continue')
  await value.press('Enter')
  await page.keyboard.press('Escape')

  await properties.getByRole('button', { name: 'Create property…' }).click()
  await page.getByRole('menuitem', { name: 'Boolean' }).click()

  await expect
    .poll(() => componentPropertyDefinitions(page, ids.buttonId))
    .toEqual([
      { name: 'Caption', type: 'TEXT', defaultValue: 'Continue' },
      { name: 'Boolean', type: 'BOOLEAN', defaultValue: 'true' }
    ])
})

test('exposes a nested instance and sets its properties from the outer instance', async () => {
  await select(ids.cardId)
  await propertySection(page, 'Properties')
    .getByRole('button', { name: 'Create property…' })
    .click()
  await page.getByRole('menuitem', { name: /Nested instances/ }).click()
  await page
    .getByRole('dialog', { name: 'Nested instances' })
    .getByRole('checkbox', { name: 'Action' })
    .click()
  await page.keyboard.press('Escape')

  await select(ids.cardInstanceId)
  const instance = propertySection(page, 'Component properties')
  await expect(instance.getByRole('button', { name: 'Action' })).toBeVisible()
  const caption = instance.getByRole('textbox', { name: 'Caption' })
  await caption.fill('Upgrade')
  await caption.press('Enter')
  await expect.poll(() => nestedInstanceText(page, ids.cardInstanceId, 'Action')).toBe('Upgrade')
})
