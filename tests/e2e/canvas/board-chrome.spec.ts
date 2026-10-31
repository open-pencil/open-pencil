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

test("a selected note offers FigJam's choices over the canvas", async () => {
  await sticky.add([{ x: 300, y: 200, text: 'Toolbar', author: 'Ada' }])
  await selectNoteAt(320, 220)

  await toolbar().getByRole('radio', { name: 'Yellow' }).click()
  await expect.poll(async () => (await lastNote()).fill).toBe('#ffe299')
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
