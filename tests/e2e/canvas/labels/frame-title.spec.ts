import type { Page } from '@playwright/test'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

type Frame = { id: string; name: string; x: number; y: number; parentId: string | null }

function topLevelFrames(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    return (pageNode?.childIds ?? []).flatMap((id) => {
      const node = store.graph.getNode(id)
      return node?.type === 'FRAME'
        ? [{ id, name: node.name, x: node.x, y: node.y, parentId: node.parentId }]
        : []
    })
  })
}

function selection(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
}

/** A point on a frame's name, which sits just above its top-left corner, in canvas pixels. */
function namePoint(page: Page, frame: Frame) {
  return page.evaluate((target) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const { zoom, panX, panY } = store.state
    return { x: target.x * zoom + panX + 6, y: target.y * zoom + panY - 13 }
  }, frame)
}

test('a frame holding a dragged-in frame is selected and moved by its name', async () => {
  const { canvas, page } = editor
  await canvas.selectTool('frame')
  await canvas.drag(100, 100, 500, 450)
  await canvas.selectTool('frame')
  await canvas.drag(650, 100, 800, 250)
  await canvas.selectTool('select')
  // Drag the second frame by its body into the first.
  await canvas.drag(725, 175, 300, 280)
  await canvas.waitForRender()

  const [outer] = await topLevelFrames(page)
  expect(await topLevelFrames(page)).toHaveLength(1)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  expect(await selection(page)).toEqual([])

  // Its body is a background now, as in Figma, so its name is how it is picked.
  const name = await namePoint(page, outer)
  await canvas.click(name.x, name.y)
  await expect.poll(() => selection(page)).toEqual([outer.id])

  await page.keyboard.press('Escape')
  await canvas.drag(name.x, name.y, name.x + 80, name.y + 40)
  await canvas.waitForRender()
  const [moved] = await topLevelFrames(page)
  expect(moved.id).toBe(outer.id)
  expect(moved.x).toBeCloseTo(outer.x + 80, 0)
  expect(moved.y).toBeCloseTo(outer.y + 40, 0)
})
