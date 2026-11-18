import { expectDefined } from '@open-pencil/test-support/assert'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { CanvasGuideDriver } from '#tests/helpers/canvas/guides'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetup()

const commentTool = () => editor.page.getByTestId(toolbarToolTestId('COMMENT'))
const moveTool = () => editor.page.getByTestId(toolbarToolTestId('SELECT'))
const list = () => editor.page.locator('[data-slot="comments-panel"]')
const items = () => list().locator('[data-slot="comment-list-item"]')
const pins = () => editor.page.locator('[data-slot="comment-pin"]:not([data-draft])')
async function selectedIds() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.state.selectedIds]
  })
}
async function selectedGuide() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.guides.selected
  })
}
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

/** A rectangle at a canvas point, kept out of the way of the earlier tests' layers. */
async function addRect(x: number, y: number) {
  return editor.page.evaluate(
    ({ x, y }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        x,
        y,
        width: 80,
        height: 60,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      })
      store.requestRender()
      return node.id
    },
    { x, y }
  )
}

/** Where a canvas point is on the page, with the view centered on `center` first. */
async function pagePoints(center: { x: number; y: number }, points: { x: number; y: number }[]) {
  const view = await editor.page.evaluate((center) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.centerOn(center.x, center.y)
    return { panX: store.state.panX, panY: store.state.panY, zoom: store.state.zoom }
  }, center)
  await editor.canvas.waitForRender()
  const canvas = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  return points.map((point) => ({
    x: canvas.x + view.panX + point.x * view.zoom,
    y: canvas.y + view.panY + point.y * view.zoom
  }))
}

async function select(ids: string[]) {
  await editor.page.evaluate((ids) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.select(ids)
  }, ids)
}

// In Figma, the Comment tool's right-click selects the layer under it and opens a short menu.
test('right-clicking a layer in the Comment tool selects it and opens a short layer menu', async () => {
  const first = await addRect(5000, 5000)
  const second = await addRect(5200, 5000)
  const [onSecond, empty] = await pagePoints({ x: 5140, y: 5030 }, [
    { x: 5240, y: 5030 },
    { x: 5140, y: 5200 }
  ])
  await select([first])
  await commentTool().click()

  await editor.page.mouse.click(onSecond.x, onSecond.y, { button: 'right' })
  const menu = editor.page.getByRole('menu')
  await expect(menu.getByTestId('context-toggle-visibility')).toHaveCount(1)
  await expect(menu.getByTestId('context-toggle-lock')).toHaveCount(1)
  await expect(menu.getByTestId('context-hide-comments')).toHaveCount(1)
  await expect(menu.getByTestId('context-copy')).toHaveCount(0)
  expect(await selectedIds()).toEqual([second])
  await editor.page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(commentTool()).toHaveAttribute('aria-pressed', 'true')

  // Over empty canvas the selection stays, and the menu offers only how the canvas looks.
  await editor.page.mouse.click(empty.x, empty.y, { button: 'right' })
  await expect(menu.getByTestId('context-toggle-ui')).toHaveCount(1)
  await expect(menu.getByTestId('context-toggle-visibility')).toHaveCount(0)
  expect(await selectedIds()).toEqual([second])
  await editor.page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(editor.page.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0)
})

test('presses on a guide in the Comment tool keep it selected and place a comment', async () => {
  await moveTool().click()
  const guides = new CanvasGuideDriver(editor.page)
  const guidePoint = await guides.addFromRuler('x', 400, 300)
  const guideSelection = await selectedGuide()
  expect(guideSelection).not.toBeNull()

  await commentTool().click()
  await editor.page.mouse.click(guidePoint.x, guidePoint.y, { button: 'middle' })
  expect(await selectedGuide()).toEqual(guideSelection)

  await editor.page.mouse.move(guidePoint.x, guidePoint.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(guidePoint.x + 40, guidePoint.y, { steps: 4 })
  await editor.page.mouse.up()
  await expect(editor.page.getByRole('textbox', { name: 'Add a comment' })).toBeFocused()
  expect(await selectedGuide()).toEqual(guideSelection)
  await editor.page.keyboard.press('Escape')
})

test('double-clicking text does not start editing in the Comment tool', async () => {
  const textPosition = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      x: 100,
      y: 100,
      width: 180,
      height: 40,
      text: 'Comment mode text'
    })
    store.requestRender()
    return {
      x: node.x,
      y: node.y,
      panX: store.state.panX,
      panY: store.state.panY,
      zoom: store.state.zoom
    }
  })
  await editor.canvas.waitForRender()
  await commentTool().click()
  const canvas = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.dblclick(
    canvas.x + textPosition.panX + (textPosition.x + 10) * textPosition.zoom,
    canvas.y + textPosition.panY + (textPosition.y + 10) * textPosition.zoom
  )

  const editingTextId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.editingTextId
  })
  expect(editingTextId).toBeNull()
})

test('middle mouse pans the canvas while the Comment tool is selected', async () => {
  await commentTool().click()
  await placeComment(200, 180, 'pan anchor')
  await editor.page.keyboard.press('Escape')

  const before = expectDefined(await pins().first().boundingBox(), 'pin bounds')
  const canvas = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  const x = canvas.x + canvas.width * 0.75
  const y = canvas.y + canvas.height * 0.75
  await editor.page.mouse.move(x, y)
  await editor.page.mouse.down({ button: 'middle' })
  await editor.page.mouse.move(x + 60, y + 45, { steps: 4 })
  await editor.page.mouse.up({ button: 'middle' })

  await expect
    .poll(async () => {
      const after = await pins().first().boundingBox()
      return after ? Math.hypot(after.x - before.x, after.y - before.y) : 0
    })
    .toBeGreaterThan(20)
  await expect(editor.page.getByRole('textbox', { name: 'Add a comment' })).toHaveCount(0)
})
