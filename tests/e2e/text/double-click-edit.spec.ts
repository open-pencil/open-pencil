import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { getEditingTextId } from '#tests/helpers/store'

async function addTwoTopLevelTexts(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const first = store.createShape('TEXT', 200, 200, 150, 30)
    const second = store.createShape('TEXT', 200, 250, 150, 30)
    store.graph.updateNode(first, { text: 'First label', fontSize: 18 })
    store.graph.updateNode(second, { text: 'Second label', fontSize: 18 })
    store.select([first])
    store.requestRender()
    return { first, second }
  })
}

async function addTopLevelText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
    store.requestRender()
    return id
  })
}

const WHITE = [
  { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }
]

/** A selected top-level card holding a text, directly or inside an inner frame. */
async function addFrameWithNestedText(page: Page, inner = false) {
  return page.evaluate(
    ({ inner, white }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.state.zoom = 1
      store.state.panX = 0
      store.state.panY = 0
      const pageId = store.state.currentPageId
      const frame = store.graph.createNode('FRAME', pageId, {
        name: 'Card',
        x: 100,
        y: 100,
        width: 240,
        height: 140,
        fills: white
      })
      const holder = inner
        ? store.graph.createNode('FRAME', frame.id, {
            name: 'Inner',
            x: 10,
            y: 10,
            width: 220,
            height: 120,
            fills: [
              { type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, opacity: 1, visible: true }
            ]
          })
        : frame
      const text = store.graph.createNode('TEXT', holder.id, {
        name: 'Nested label',
        text: 'Nested label',
        x: 20,
        y: 20,
        width: 140,
        height: 30,
        fontSize: 18
      })
      store.select([frame.id])
      store.requestRender()
      return { frameId: frame.id, innerId: inner ? holder.id : null, textId: text.id }
    },
    { inner, white: WHITE }
  )
}

const selectedIds = (page: Page) =>
  page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })

test('double-clicks reach nested text one level at a time and edit it last', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addFrameWithNestedText(page, true)
  await canvas.waitForRender()

  // Card is top-level, so a click reaches Inner; Inner's text takes a double-click to select and
  // another to edit, as in Figma.
  await canvas.click(145, 145)
  await expect.poll(() => selectedIds(page)).toEqual([ids.innerId])
  await page.waitForTimeout(600)
  await canvas.dblclick(145, 145)
  await expect.poll(() => selectedIds(page)).toEqual([ids.textId])
  expect(await getEditingTextId(page)).toBeNull()
  await page.waitForTimeout(600)
  await canvas.dblclick(145, 145)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.textId)
})

test('quick clicks reach nested text and select it; a double-click then edits', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addFrameWithNestedText(page, true)
  await canvas.waitForRender()
  await page.evaluate(() => window.openPencil?.getStore?.().clearSelection())

  // Card is top-level: click one reaches Inner, click two the text, click three keeps it.
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('canvas bounds')
  await page.mouse.move(box.x + 145, box.y + 145)
  for (const [count, expected] of [ids.innerId, ids.textId, ids.textId].entries()) {
    await page.mouse.down({ clickCount: count + 1 })
    await page.mouse.up({ clickCount: count + 1 })
    await expect.poll(() => selectedIds(page)).toEqual([expected])
    await page.waitForTimeout(80)
  }
  expect(await getEditingTextId(page)).toBeNull()
  await page.waitForTimeout(600)
  await canvas.dblclick(145, 145)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.textId)
})

test('double-clicking top-level text enters text edit mode', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const textId = await addTopLevelText(page)
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.dblclick(275, 215)

  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(textId)
})

test('single-clicking another text switches text edit target', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addTwoTopLevelTexts(page)
  await canvas.waitForRender()
  await canvas.dblclick(245, 215)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.first)

  await canvas.click(250, 265)
  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.second)
})

test('double-click drill enters nested text edit mode', async ({ page }) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  canvas.errors.length = 0
  await canvas.clearCanvas()

  const ids = await addFrameWithNestedText(page)
  await canvas.waitForRender()

  await canvas.dblclick(125, 125)

  await expect.poll(() => getEditingTextId(page), { timeout: 3000 }).toBe(ids.textId)
  await expect.poll(() => selectedIds(page)).toEqual([ids.textId])
})
