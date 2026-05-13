import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('dragging selected nested instance content reorders its auto-layout item', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1

    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Auto Row',
      x: 100,
      y: 100,
      width: 360,
      height: 80,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 20,
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10
    })

    const first = store.graph.createNode('INSTANCE', frame.id, {
      name: 'First item',
      x: 110,
      y: 110,
      width: 120,
      height: 60
    })
    store.graph.createNode('TEXT', first.id, {
      name: 'First label',
      text: 'First',
      x: 8,
      y: 8,
      width: 80,
      height: 24
    })

    const second = store.graph.createNode('INSTANCE', frame.id, {
      name: 'Second item',
      x: 250,
      y: 110,
      width: 120,
      height: 60
    })
    const secondText = store.graph.createNode('TEXT', second.id, {
      name: 'Second label',
      text: 'Second',
      x: 8,
      y: 8,
      width: 80,
      height: 24
    })

    store.select([secondText.id])
    store.requestRender()
    return { frame: frame.id, first: first.id, second: second.id, secondText: secondText.id }
  })
  await canvas.waitForRender()

  await canvas.drag(370, 228, 230, 228, 12)
  await canvas.waitForRender()

  const childIds = await page.evaluate((frameId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getNode(frameId)?.childIds ?? []
  }, ids.frame)

  expect(childIds).toEqual([ids.second, ids.first])
  canvas.assertNoErrors()
})
