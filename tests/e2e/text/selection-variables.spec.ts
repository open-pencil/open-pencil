import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

let page: Page
let canvas: CanvasHelper
let textId = ''

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
  textId = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const { graph } = store
    for (const id of graph.variableCollections.keys()) graph.removeCollection(id)
    const collection = graph.createCollection('Brand')
    graph.createVariable('Accent', 'COLOR', collection.id, { r: 0.9, g: 0.1, b: 0.2, a: 1 })
    const pageId = store.state.currentPageId
    const style = graph.createNode('TEXT', pageId, {
      name: 'Heading',
      sharedStyleType: 'TEXT',
      internalOnly: true,
      fontFamily: 'Inter',
      fontSize: 28
    })
    style.source.id = 'style:heading'
    const id = store.createShape('TEXT', 200, 200, 240, 40)
    store.graph.updateNode(id, { text: 'Hello world', fontSize: 18 })
    store.select([id])
    return id
  })
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
})

test.afterEach(async () => {
  await page.close()
})

/** Edits the text and selects "world" with the keyboard, as a person would. */
async function selectWorld() {
  await canvas.dblclick(260, 215)
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.().state.editingTextId))
    .toBe(textId)
  await page.keyboard.press('End')
  for (let step = 0; step < 5; step++) await page.keyboard.press('Shift+ArrowLeft')
}

function runs() {
  return page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.styleRuns, textId)
}

function layer() {
  return page.evaluate((id) => {
    const node = window.openPencil?.getStore?.().graph.getNode(id)
    return { boundVariables: node?.boundVariables, textStyleId: node?.textStyleId }
  }, textId)
}

test('a colour variable applied to selected words colours only them', async () => {
  await selectWorld()
  const fill = page.getByRole('region', { name: 'Fill', exact: true })
  await fill.getByRole('button', { name: 'Apply variable' }).click()
  await page
    .getByRole('dialog', { name: 'Apply variable' })
    .getByRole('option', { name: /Accent/ })
    .click()

  await expect.poll(runs).toMatchObject([{ start: 6, length: 5 }])
  await expect
    .poll(async () => Object.keys((await runs())?.[0]?.style.boundVariables ?? {}))
    .toEqual(['fills/0/color'])
  expect(await layer()).toMatchObject({ boundVariables: {} })
  // The panel shows the selection bound to the variable.
  await expect(fill).toContainText('Accent')
  canvas.assertNoErrors()
})

test('a text style applied to selected words styles only them', async () => {
  await selectWorld()
  const typography = page.getByRole('region', { name: 'Typography' })
  await typography.getByRole('combobox', { name: 'Text style' }).click()
  await page.getByRole('option', { name: 'Heading', exact: true }).click()

  await expect
    .poll(runs)
    .toMatchObject([{ start: 6, length: 5, style: { textStyleId: 'style:heading', fontSize: 28 } }])
  expect(await layer()).toMatchObject({ textStyleId: null })
  canvas.assertNoErrors()
})
