import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { clickDepthDriver } from '#tests/helpers/canvas/click-depth/driver'

// Measured in Figma desktop 126 (scratch/pr-oracle/nav-keys.ts): Escape clears the selection at
// any depth, and Shift+Enter is the way up a level.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const scene = clickDepthDriver(() => editor.page)

test('Escape inside an entered container clears the selection', async () => {
  const { grid, cell, label } = await scene.nestedBoard()
  await editor.canvas.waitForRender()
  const point = await scene.at(label, 20, 20)

  await editor.canvas.click(point.x, point.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([grid])
  await editor.canvas.dblclick(point.x, point.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([cell])
  expect((await scene.state()).entered).toBe(grid)

  await editor.page.keyboard.press('Escape')
  await expect.poll(async () => (await scene.state()).selected).toEqual([])
  expect((await scene.state()).entered).toBeNull()
  editor.canvas.assertNoErrors()
})

test('Shift+Enter after a click on a nested layer selects its parent', async () => {
  const { plain } = await scene.cards()
  await editor.canvas.waitForRender()
  const button = await scene.at(plain, 100, 108)

  await editor.canvas.click(button.x, button.y)
  await editor.page.keyboard.press('Shift+Enter')
  await expect.poll(async () => (await scene.state()).selected).toEqual([plain])
  editor.canvas.assertNoErrors()
})
