import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyItems, propertySection } from '#tests/helpers/properties'

let page: Page
let canvas: CanvasHelper
let targetId = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  targetId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const fill = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Brand/Primary',
      fills: [
        {
          type: 'SOLID',
          color: { r: 0.9, g: 0.2, b: 0.15, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    fill.source.id = '1:100'
    const text = store.graph.createNode('TEXT', pageId, {
      name: 'Type/Display',
      fontFamily: 'Inter',
      fontSize: 30,
      fontWeight: 700,
      lineHeight: 38,
      sharedStyleType: 'TEXT',
      internalOnly: true
    })
    text.source.id = '1:101'
    const effect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Effects/Card',
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 6 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ],
      sharedStyleType: 'EFFECT',
      internalOnly: true
    })
    effect.source.id = '1:102'
    const grid = store.graph.createNode('FRAME', pageId, {
      name: 'Grid/12 columns',
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }],
      sharedStyleType: 'GRID',
      internalOnly: true
    })
    grid.source.id = '1:103'
    const target = store.graph.createNode('FRAME', pageId, {
      name: 'Style target',
      x: 120,
      y: 100,
      width: 240,
      height: 160
    })
    store.select([target.id])
    store.requestRender()
    return target.id
  })
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

async function chooseStyle(section: string, label: string, option: string) {
  await propertySection(page, section).getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
  await canvas.waitForRender()
}

async function targetStyles(id = targetId) {
  return page.evaluate((nodeId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.getNode(nodeId)
    return node
      ? {
          fillStyleId: node.fillStyleId,
          strokeStyleId: node.strokeStyleId,
          textStyleId: node.textStyleId,
          effectStyleId: node.effectStyleId,
          gridStyleId: node.gridStyleId,
          fillColor: node.fills[0]?.color,
          effects: node.effects.length,
          grids: node.layoutGrids.length,
          fontSize: node.fontSize
        }
      : null
  }, id)
}

test('applies fill, stroke, effect, and grid styles from local definitions', async () => {
  await chooseStyle('Fill', 'Fill style', 'Brand/Primary')
  await chooseStyle('Stroke', 'Stroke style', 'Brand/Primary')
  await chooseStyle('Effects', 'Effect style', 'Effects/Card')
  await chooseStyle('Layout guide', 'Grid style', 'Grid/12 columns')

  expect(await targetStyles()).toMatchObject({
    fillStyleId: '1:100',
    strokeStyleId: '1:100',
    effectStyleId: '1:102',
    gridStyleId: '1:103',
    fillColor: { r: 0.9, g: 0.2, b: 0.15, a: 1 },
    effects: 1,
    grids: 1
  })
})

test('manual paint edits detach the style and undo restores the reference', async () => {
  await propertyItems(page, 'fills').first().hover()
  await propertySection(page, 'Fill').getByRole('button', { name: 'Remove fill' }).click()
  await canvas.waitForRender()
  expect((await targetStyles())?.fillStyleId).toBeNull()

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect(await targetStyles()).toMatchObject({ fillStyleId: '1:100', fillColor: { r: 0.9 } })
})

test('applies text styles and batches mixed selection binding', async () => {
  const textId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const text = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'Text target',
      text: 'Shared style',
      x: 420,
      y: 120
    })
    store.select([text.id])
    return text.id
  })
  await canvas.waitForRender()
  await chooseStyle('Typography', 'Text style', 'Type/Display')
  expect(await targetStyles(textId)).toMatchObject({
    textStyleId: '1:101',
    fontSize: 30
  })

  const secondId = await page.evaluate((firstId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const second = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Second style target',
      x: 120,
      y: 320,
      width: 240,
      height: 120
    })
    store.select([firstId, second.id])
    return second.id
  }, targetId)
  await canvas.waitForRender()
  await chooseStyle('Fill', 'Fill style', 'Brand/Primary')
  expect((await targetStyles(targetId))?.fillStyleId).toBe('1:100')
  expect((await targetStyles(secondId))?.fillStyleId).toBe('1:100')

  await canvas.pressKey('Meta+z')
  await canvas.waitForRender()
  expect((await targetStyles(targetId))?.fillStyleId).toBe('1:100')
  expect((await targetStyles(secondId))?.fillStyleId).toBeNull()
})
