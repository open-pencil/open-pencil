import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { clickDepthDriver } from '#tests/helpers/canvas/click-depth-driver'

// Matches Figma desktop 126 with the same pointer input: the gaps and padding of a top-level auto
// layout frame select, highlight, and drag it, while those of a plain top-level frame are background.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const scene = clickDepthDriver(() => editor.page)

test('hovering and clicking the empty area of a top-level auto layout frame selects it', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(auto, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  await expect.poll(async () => (await scene.state()).hovered).toBe(auto)

  await editor.canvas.click(gap.x, gap.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('a click on a layer in a top-level auto layout frame still selects the layer', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const button = await scene.at(auto, 100, 108)
  const [, buttonId] = await scene.children(auto)

  await editor.canvas.click(button.x, button.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([buttonId])
  editor.canvas.assertNoErrors()
})

test('dragging the empty area of a top-level auto layout frame moves it', async () => {
  const { auto } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(auto, 100, 200)

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  await expect.poll(() => scene.position(auto)).toEqual({ x: 160, y: 140 })
  expect((await scene.state()).selected).toEqual([auto])
  editor.canvas.assertNoErrors()
})

test('the empty area of a plain top-level frame stays background', async () => {
  const { plain } = await scene.cards()
  await editor.canvas.waitForRender()
  const gap = await scene.at(plain, 100, 200)

  await editor.canvas.hover(gap.x, gap.y)
  expect((await scene.state()).hovered).toBeNull()

  await editor.canvas.click(gap.x, gap.y)
  expect((await scene.state()).selected).toEqual([])

  await editor.canvas.drag(gap.x, gap.y, gap.x + 60, gap.y + 40)
  expect(await scene.position(plain)).toEqual({ x: 400, y: 100 })
  editor.canvas.assertNoErrors()
})

test('repeated clicks at one point reach deeper layers, one level at a time', async () => {
  const ids = await scene.nestedBoard()
  await editor.canvas.waitForRender()
  const point = await scene.at(ids.label, 20, 20)

  for (const expected of [ids.grid, ids.cell, ids.label]) {
    await editor.canvas.click(point.x, point.y)
    await expect.poll(async () => (await scene.state()).selected).toEqual([expected])
    // Apart enough not to count as a double-click, which goes one level deeper by itself.
    await editor.page.waitForTimeout(600)
  }
  editor.canvas.assertNoErrors()
})

test('holding Cmd hovers the deepest layer, the one a Cmd-click selects', async () => {
  const ids = await scene.nestedBoard()
  await editor.canvas.waitForRender()
  const point = await scene.at(ids.label, 20, 20)

  await editor.canvas.hover(point.x, point.y)
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.grid)
  await editor.page.keyboard.down('Meta')
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.label)
  await editor.page.keyboard.up('Meta')
  await expect.poll(async () => (await scene.state()).hovered).toBe(ids.grid)
  editor.canvas.assertNoErrors()
})
