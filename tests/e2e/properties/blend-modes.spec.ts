import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper
let firstId = ''
let secondId = ''

async function chooseBlend(sectionName: string, option: string) {
  const section = propertySection(page, sectionName)
  await section.getByRole('combobox', { name: 'Blend mode' }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await canvas.waitForRender()
}

async function nodeState(id: string) {
  return page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(nodeId)
    return node
      ? {
          fillBlend: node.fills[0]?.blendMode ?? 'NORMAL',
          effectBlend: node.effects[0]?.blendMode ?? 'NORMAL',
          fillStyleId: node.fillStyleId,
          effectStyleId: node.effectStyleId
        }
      : null
  }, id)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  ;[firstId, secondId] = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const props = {
      fills: [
        {
          type: 'SOLID' as const,
          color: { r: 0.85, g: 0.2, b: 0.15, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL' as const
        }
      ],
      effects: [
        {
          type: 'DROP_SHADOW' as const,
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL' as const
        }
      ],
      fillStyleId: '1:10',
      effectStyleId: '1:11',
      width: 160,
      height: 100
    }
    const first = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      ...structuredClone(props),
      name: 'Blend first',
      x: 160,
      y: 160
    })
    const second = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      ...structuredClone(props),
      name: 'Blend second',
      x: 360,
      y: 160
    })
    store.select([first.id])
    return [first.id, second.id]
  })
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('edits fill and effect blend modes with style detachment and undo', async () => {
  await chooseBlend('Fill', 'Multiply')
  expect(await nodeState(firstId)).toMatchObject({ fillBlend: 'MULTIPLY', fillStyleId: null })
  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await nodeState(firstId)).toMatchObject({ fillBlend: 'NORMAL', fillStyleId: '1:10' })

  const effects = propertySection(page, 'Effects')
  await effects.getByRole('button', { name: 'Expand effect settings' }).click()
  await chooseBlend('Effects', 'Screen')
  expect(await nodeState(firstId)).toMatchObject({ effectBlend: 'SCREEN', effectStyleId: null })
  await expect(effects).toHaveScreenshot('effect-blend-mode.png')
})

test('batches fill blend modes across a compatible selection', async () => {
  await page.evaluate(
    ([first, second]) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.select([first, second])
    },
    [firstId, secondId]
  )
  await canvas.waitForRender()
  await chooseBlend('Fill', 'Overlay')
  expect(await nodeState(firstId)).toMatchObject({ fillBlend: 'OVERLAY' })
  expect(await nodeState(secondId)).toMatchObject({ fillBlend: 'OVERLAY' })

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await nodeState(firstId)).toMatchObject({ fillBlend: 'NORMAL' })
  expect(await nodeState(secondId)).toMatchObject({ fillBlend: 'NORMAL' })
})
