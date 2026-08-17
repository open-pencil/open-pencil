import { expect, test, type Page } from '@playwright/test'

import type { Vector } from '@open-pencil/scene-graph'

import { CanvasHelper } from '#tests/helpers/canvas'

async function dragLayerAndObserveIndicator(
  page: Page,
  sourceId: string,
  targetId: string,
  targetPosition: Vector
) {
  await page.evaluate(() => {
    const positions: string[] = []
    new MutationObserver(() => {
      for (const element of document.querySelectorAll<HTMLElement>(
        '[data-slot="drop-indicator"]'
      )) {
        const position = element.dataset.dropPosition
        if (position) positions.push(position)
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true })
    Object.assign(window, { __layerDropPositions: positions })
  })

  const source = page.locator(`[data-node-id="${sourceId}"]`)
  const target = page.locator(`[data-node-id="${targetId}"]`)
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Layer row bounds unavailable')

  await page.mouse.move(sourceBox.x + 80, sourceBox.y + 12)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x + 84, sourceBox.y + 8, { steps: 5 })
  await page.mouse.move(targetBox.x + targetPosition.x, targetBox.y + targetPosition.y, {
    steps: 20
  })
  await expect(target.locator('[data-slot="drop-indicator"]')).toBeVisible()
  await page.mouse.up()

  return page.evaluate(
    () => (window as typeof window & { __layerDropPositions?: string[] }).__layerDropPositions ?? []
  )
}

test('layer reorder exposes a visible drop indicator before dropping', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const first = store.graph.createNode('RECTANGLE', pageId, { name: 'Layer A' })
    store.graph.createNode('RECTANGLE', pageId, { name: 'Layer B' })
    const third = store.graph.createNode('RECTANGLE', pageId, { name: 'Layer C' })
    store.requestRender()
    return { first: first.id, third: third.id }
  })
  await canvas.waitForRender()

  const positions = await dragLayerAndObserveIndicator(page, ids.third, ids.first, {
    x: 80,
    y: 2
  })

  expect(positions).toContain('above')
  canvas.assertNoErrors()
})

test('layer child drop exposes a visible container highlight before dropping', async ({ page }) => {
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      name: 'Drop Frame',
      width: 200,
      height: 120
    })
    const rect = store.graph.createNode('RECTANGLE', pageId, { name: 'Child Candidate' })
    store.requestRender()
    return { frame: frame.id, rect: rect.id }
  })
  await canvas.waitForRender()

  const positions = await dragLayerAndObserveIndicator(page, ids.rect, ids.frame, {
    x: 80,
    y: 12
  })

  expect(positions).toContain('child')
  canvas.assertNoErrors()
})
