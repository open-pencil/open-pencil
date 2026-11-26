import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'

const editor = useEditorSetup()
const deck = deckDriver(() => editor.page)

test.afterEach(() => deck.close())

const rows = () => editor.page.getByTestId('slides-panel').getByRole('treeitem')

test('the filmstrip puts a slide on the stage, and switches between Slide and Grid view', async () => {
  const ids = await deck.open([3])
  await expect(rows()).toHaveCount(3)
  await rows().nth(1).click()
  expect(await deck.staged()).toBeNull()
  await editor.page.getByTestId('slides-toggle-view').click()
  expect(await deck.staged()).toBe(ids[1])
  await rows().nth(1).press('ArrowDown')
  expect(await deck.staged()).toBe(ids[2])
  await editor.page.getByTestId('slides-toggle-view').click()
  expect(await deck.staged()).toBeNull()
})

test('Shift+S adds a slide after the selected one, and undo takes it back', async () => {
  await deck.open([2])
  await rows().first().click()
  await editor.page.keyboard.press('Shift+S')
  await expect(rows()).toHaveCount(3)
  expect(await deck.names()).toEqual([['1', '2', '3']])
  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect(rows()).toHaveCount(2)
})

test('dragging a slide in the filmstrip moves it after the slide it is dropped on', async () => {
  const ids = await deck.open([3])
  await rows()
    .first()
    .dragTo(rows().nth(2), { targetPosition: { x: 40, y: 50 } })
  const order = await deck.order()
  expect(order).toEqual([[ids[1], ids[2], ids[0]]])
})

test('folding a section hides all but its first slide, and unfolding shows them again', async () => {
  await deck.open([1, 3])
  const toggle = editor.page.getByTestId('slides-section-toggle')
  await expect(toggle).toHaveCount(1)
  await toggle.click()
  await expect(rows()).toHaveCount(2)
  await toggle.click()
  await expect(rows()).toHaveCount(4)
})

test('speaker notes are kept when the field is left, as one undo step', async () => {
  const [first] = await deck.open([1])
  await deck.show(first)
  const field = editor.page.getByTestId('slide-notes-field')
  await field.fill('Open with the numbers')
  await field.blur()
  const notes = () => deck.notes(first)
  expect(await notes()).toBe('Open with the numbers')
  await editor.page.keyboard.press('ControlOrMeta+z')
  expect(await notes()).toBe('')
  await expect(field).toHaveValue('')
})

test('a slide size picked with nothing selected resizes every slide', async () => {
  const [first] = await deck.open([1])
  await deck.select([])
  await editor.page.getByTestId('slide-size').locator('[data-property=slide-size-preset]').click()
  await editor.page.getByRole('option', { name: /^4:3/ }).click()
  const size = await deck.size(first)
  expect(size).toEqual({ width: 1440, height: 1080 })
})
