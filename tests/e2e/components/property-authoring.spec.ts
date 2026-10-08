import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

interface Fixture {
  buttonId: string
  labelId: string
  cardId: string
  cardInstanceId: string
}

let page: Page
let canvas: CanvasHelper
let ids: Fixture

async function select(nodeId: string) {
  await page.evaluate((id) => window.openPencil?.getStore?.()?.select([id]), nodeId)
  await canvas.waitForRender()
}

async function definitions(componentId: string) {
  return page.evaluate(
    (id) =>
      window.openPencil
        ?.getStore?.()
        ?.graph.getNode(id)
        ?.componentPropertyDefinitions.map(({ name, type, defaultValue }) => ({
          name,
          type,
          defaultValue
        })) ?? [],
    componentId
  )
}

async function nestedLabel(instanceId: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const action = store?.graph.getChildren(id).find((node) => node.name === 'Action')
    return action
      ? store?.graph.getChildren(action.id).find((node) => node.type === 'TEXT')?.text
      : null
  }, instanceId)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const button = store.graph.createNode('COMPONENT', pageId, { name: 'Button', width: 120 })
    const label = store.graph.createNode('TEXT', button.id, { name: 'Label', text: 'Button' })
    const card = store.graph.createNode('COMPONENT', pageId, { name: 'Card', y: 120, width: 200 })
    const action = store.graph.createInstance(button.id, card.id, { name: 'Action' })
    const cardInstance = store.graph.createInstance(card.id, pageId, { x: 300, y: 120 })
    if (!action || !cardInstance) throw new Error('Expected instances')
    return {
      buttonId: button.id,
      labelId: label.id,
      cardId: card.id,
      cardInstanceId: cardInstance.id
    }
  })
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
    .poll(() => definitions(ids.buttonId))
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
    .poll(() => definitions(ids.buttonId))
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
  await expect.poll(() => nestedLabel(ids.cardInstanceId)).toBe('Upgrade')
})
