import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

// Figma desktop 126 grows a Hug frame with its label as the label is typed, and keeps it fitting
// through undo and redo.

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/?test&no-rulers')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
})

test.afterAll(async () => {
  await page.close()
})

function sizes() {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const text = [...(store?.graph.getAllNodes() ?? [])].find((node) => node.type === 'TEXT')
    const frame = text?.parentId ? store?.graph.getNode(text.parentId) : undefined
    return { id: text?.id ?? '', text: text?.width ?? 0, frame: frame?.width ?? 0 }
  })
}

test('a Hug frame grows with its label while it is typed', async () => {
  await canvas.clearCanvas()
  await canvas.selectTool('text')
  await canvas.click(300, 300)
  await page.keyboard.type('Hi')
  await page.keyboard.press('Escape')
  await canvas.waitForRender()
  // Shift+A wraps the text in an auto layout frame that hugs it.
  await page.keyboard.press('Shift+a')
  await canvas.waitForRender()
  const wrapped = await sizes()
  expect(wrapped.frame).toBe(wrapped.text)

  await page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    store?.select([id])
    store?.startTextEditing(id)
  }, wrapped.id)
  await page.keyboard.press('End')
  await page.keyboard.type(' there, a longer label')
  await canvas.waitForRender()
  const typing = await sizes()
  expect(typing.text).toBeGreaterThan(wrapped.text)
  expect(typing.frame).toBe(typing.text)

  await page.keyboard.press('Escape')
  await canvas.waitForRender()
  const committed = await sizes()
  expect(committed.frame).toBe(committed.text)

  await canvas.undo()
  await expect.poll(sizes).toMatchObject({ text: wrapped.text, frame: wrapped.frame })
  await canvas.redo()
  await expect.poll(sizes).toMatchObject({ text: committed.text, frame: committed.frame })
  canvas.assertNoErrors()
})
