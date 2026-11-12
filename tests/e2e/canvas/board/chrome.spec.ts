import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { boardDriver } from '#tests/helpers/canvas/board-driver'
import { stickyDriver } from '#tests/helpers/canvas/sticky-driver'

const editor = useEditorSetupWithClear()
const board = boardDriver(() => editor.page)
const sticky = stickyDriver(() => editor.page)

test.beforeEach(async () => {
  await editor.page.keyboard.press('Escape')
  await board.open()
  await sticky.showOrigin()
})

test.afterEach(() => board.close())

const toolbar = () => editor.page.getByTestId('selection-toolbar')
/** The toolbar menu that is open, not one still closing. */
const openMenu = () => editor.page.locator('[data-menu][data-state=open]')

async function lastNote() {
  const note = (await sticky.notes()).at(-1)
  if (!note) throw new Error('Missing sticky note')
  return note
}

async function selectNoteAt(x: number, y: number) {
  const point = sticky.point(x, y)
  await editor.canvas.click(point.x, point.y)
  await editor.canvas.waitForRender()
}

test('a board opens on the canvas and its tools, with the panels one click away', async () => {
  await expect(editor.page.getByTestId('editor-show-ui')).toBeVisible()
  await expect(editor.page.getByTestId('toolbar')).toBeVisible()
  await expect(editor.page.getByRole('region', { name: 'Sticky note' })).toHaveCount(0)
})

// Live-checked in FigJam: its toolbar has no context menu, and a board's tools are fixed.
test("a board's toolbar offers no customizing", async () => {
  await editor.page.getByTestId('toolbar').click({ button: 'right' })
  await expect(editor.page.getByRole('menu')).toHaveCount(0)
})

test("a selected note offers FigJam's choices over the canvas", async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Toolbar', author: 'Ada' }])
  await selectNoteAt(320, 220)

  await toolbar().locator('[data-property=toolbar-color]').click()
  await openMenu().getByRole('radio', { name: 'Yellow', exact: true }).click()
  await expect.poll(async () => (await lastNote()).fill).toBe('#ffe299')
})

// Measured in FigJam: text takes a palette colour as is, a section a pale tint of it.
test('text and sections take their colour from the toolbar', async () => {
  await board.addSelected('TEXT', 300, 200, 200, 40)
  await toolbar().locator('[data-property=toolbar-color]').click()
  await openMenu().getByRole('radio', { name: 'Red', exact: true }).click()
  await expect.poll(board.selectedFill).toEqual([242, 72, 34])

  await board.addSelected('SECTION', 300, 300, 400, 300)
  await expect(toolbar()).toHaveAttribute('data-kind', 'section')
  await toolbar().locator('[data-property=toolbar-color]').click()
  await openMenu().getByRole('radio', { name: 'Red', exact: true }).click()
  await expect.poll(board.selectedFill).toEqual([255, 226, 224])
})

// Measured in FigJam: a pick closes its menu, but a line colour leaves the line menu open.
test('a toolbar menu closes on a pick, and the line menu stays for its colours', async () => {
  await board.addSelected('SECTION', 300, 200, 400, 300)
  await toolbar().locator('[data-property=toolbar-color]').click()
  await openMenu().getByRole('radio', { name: 'Blue', exact: true }).click()
  await expect(openMenu()).toHaveCount(0)

  await toolbar().locator('[data-property=toolbar-line-style]').click()
  await openMenu().getByRole('radio', { name: 'Red', exact: true }).click()
  await expect(openMenu()).toHaveCount(1)
  await openMenu().getByRole('menuitemradio', { name: 'Dashed' }).click()
  await expect(openMenu()).toHaveCount(0)
})

test('several layers wrap into a new section from the toolbar', async () => {
  await sticky.add([
    { x: 300, y: 200, text: 'One', author: 'Ada' },
    { x: 600, y: 200, text: 'Two', author: 'Ada' }
  ])
  await board.selectAll()
  await toolbar().locator('[data-property=toolbar-wrap-section]').click()
  await expect.poll(board.layerTypes).toEqual(['SECTION'])
})

test('the controls step aside while a note is dragged', async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Drag', author: 'Ada' }])
  await selectNoteAt(320, 220)
  await expect(toolbar()).toBeVisible()

  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Missing canvas')
  const start = sticky.point(320, 220)
  await editor.page.mouse.move(box.x + start.x, box.y + start.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + start.x + 80, box.y + start.y + 40, { steps: 4 })
  await expect(toolbar()).toHaveCount(0)
  await editor.page.mouse.up()
  await expect(toolbar()).toBeVisible()
})

test('with the panels open, the note is edited from them instead', async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Panels', author: 'Ada' }])
  await editor.page.getByTestId('editor-show-ui').click()
  await selectNoteAt(320, 220)

  await expect(editor.page.getByRole('region', { name: 'Sticky note' })).toBeVisible()
  await expect(toolbar()).toHaveCount(0)
})

test('the AI chat floats over the canvas alone', async () => {
  await editor.page.getByTestId('editor-toggle-chat').click()
  await expect(editor.page.getByTestId('floating-chat')).toBeVisible()
  await editor.page.getByTestId('floating-chat-close').click()
  await expect(editor.page.getByTestId('floating-chat')).toHaveCount(0)
})
