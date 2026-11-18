import { expectDefined } from '@open-pencil/test-support/assert'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetup()

const commentTool = () => editor.page.getByTestId(toolbarToolTestId('COMMENT'))
const moveTool = () => editor.page.getByTestId(toolbarToolTestId('SELECT'))
const list = () => editor.page.locator('[data-slot="comments-panel"]')
const items = () => list().locator('[data-slot="comment-list-item"]')
const pins = () => editor.page.locator('[data-slot="comment-pin"]:not([data-draft])')
const thread = () => editor.page.locator('[data-slot="comment-thread"]')

async function placeComment(x: number, y: number, text: string) {
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.click(box.x + x, box.y + y)
  const composer = editor.page.getByRole('textbox', { name: 'Add a comment' })
  await expect(composer).toBeFocused()
  await composer.fill(text)
  await composer.press('Enter')
}

test('C picks the Comment tool, which turns the sidebar into the comments list', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.page.keyboard.press('KeyC')
  await expect(commentTool()).toHaveAttribute('aria-pressed', 'true')
  await expect(moveTool()).toHaveAttribute('aria-pressed', 'false')
  await expect(list()).toBeVisible()

  await placeComment(150, 150, 'first note')
  await expect(pins()).toHaveCount(1)
  await expect(items()).toHaveCount(1)
  // The new thread opens with its reply box ready.
  await expect(thread().getByRole('textbox', { name: 'Reply' })).toBeFocused()
})

test('replies keep line breaks and Escape closes the thread before leaving the tool', async () => {
  const reply = thread().getByRole('textbox', { name: 'Reply' })
  await reply.fill('one')
  await reply.press('Shift+Enter')
  await reply.pressSequentially('two')
  await reply.press('Enter')
  await expect(thread().locator('[data-slot="comment-message"]')).toHaveCount(2)

  await editor.page.keyboard.press('Escape')
  await expect(thread()).toHaveCount(0)
  await expect(commentTool()).toHaveAttribute('aria-pressed', 'true')
  await editor.page.keyboard.press('Escape')
  await expect(moveTool()).toHaveAttribute('aria-pressed', 'true')
  await expect(list()).toHaveCount(0)
  await expect(pins()).toHaveCount(1)
})

test('Shift+C hides pins outside the Comment tool', async () => {
  await editor.page.keyboard.press('Shift+KeyC')
  await expect(pins()).toHaveCount(0)
  await commentTool().click()
  await expect(pins()).toHaveCount(1)
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Shift+KeyC')
  await expect(pins()).toHaveCount(1)
})

test('a pin can be dragged, and the toolbar still picks tools in the Comment tool', async () => {
  await commentTool().click()
  const pin = expectDefined(await pins().first().boundingBox(), 'pin bounds')
  await editor.page.mouse.move(pin.x + 8, pin.y + pin.height - 8)
  await editor.page.mouse.down()
  await editor.page.mouse.move(pin.x + 48, pin.y + pin.height + 32, { steps: 4 })
  await editor.page.mouse.up()
  const moved = expectDefined(await pins().first().boundingBox(), 'moved pin bounds')
  expect(Math.round(moved.x - pin.x)).toBe(40)
  expect(Math.round(moved.y + moved.height - (pin.y + pin.height))).toBe(40)
  await expect(thread()).toHaveCount(0)

  // Scrolling over a pin pans the canvas under it; the pin's tip is its bottom edge.
  const tip = moved.y + moved.height
  await editor.page.mouse.move(moved.x + 8, tip - 8)
  await editor.page.mouse.wheel(0, 100)
  await expect
    .poll(async () => {
      const box = await pins().first().boundingBox()
      return box ? tip - (box.y + box.height) : 0
    })
    .toBeGreaterThan(20)

  await editor.page.getByTestId(toolbarToolTestId('RECTANGLE')).click()
  await expect(commentTool()).toHaveAttribute('aria-pressed', 'false')
  await editor.page.keyboard.press('Escape')
})

test('the list searches and resolves threads', async () => {
  await commentTool().click()
  await placeComment(260, 210, 'second note')
  await editor.page.keyboard.press('Escape')
  await expect(items()).toHaveCount(2)

  const search = list().getByRole('searchbox')
  await search.fill('second')
  await expect(items()).toHaveCount(1)
  await search.fill('')
  await expect(items()).toHaveCount(2)

  await items().first().hover()
  await items().first().locator('[data-command="comment-resolve"]').click()
  await expect(items()).toHaveCount(1)
  await expect(pins()).toHaveCount(1)
})

test('right-clicking a pin opens comment actions, not the layer menu', async () => {
  await pins().first().click({ button: 'right' })
  const menu = editor.page.getByRole('menu')
  await expect(menu.locator('[data-command="comment-resolve"]')).toHaveCount(1)
  await expect(menu.getByTestId('context-duplicate')).toHaveCount(0)
  await expect(menu.locator('[data-command="comments-hide"]')).toHaveCount(1)
  await menu.locator('[data-command="comment-delete"]').click()
  await editor.page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(pins()).toHaveCount(0)
  await expect(items()).toHaveCount(0)
})

// Zoomed out, pins that crowd each other show as one bubble with their count, as in Figma, and
// clicking it zooms in until they part.
test('crowded pins gather into a count bubble that zooms in when clicked', async () => {
  const clusters = () => editor.page.locator('[data-slot="comment-cluster"]')
  const view = (zoom: number) =>
    editor.page.evaluate((zoom) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.centerOn(9000, 9000, zoom)
      return store.state.zoom
    }, zoom)

  await view(1)
  await commentTool().click()
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  const cx = box.width / 2
  const cy = box.height / 2
  for (const [dx, dy] of [
    [0, 0],
    [30, 40],
    [70, 10]
  ] as const) {
    await placeComment(cx + dx, cy + dy, `crowd ${dx}`)
    await editor.page.keyboard.press('Escape')
  }
  const before = await pins().count()
  await expect(clusters()).toHaveCount(0)

  await view(0.25)
  await expect(clusters()).toHaveCount(1)
  await expect(clusters()).toHaveText('3')
  await expect(clusters()).toHaveAccessibleName(/3/)
  await expect(pins()).toHaveCount(before - 3)

  await clusters().click()
  await expect(clusters()).toHaveCount(0)
  await expect(pins()).toHaveCount(before)
  const zoom = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.zoom
  })
  expect(zoom).toBeGreaterThan(0.5)

  // From the keyboard, focus moves on to a pin the cluster held.
  await view(0.25)
  await clusters().focus()
  await editor.page.keyboard.press('Enter')
  await expect(clusters()).toHaveCount(0)
  await expect(editor.page.locator('[data-thread-id]:focus')).toHaveCount(1)
  await editor.page.keyboard.press('Escape')
})
