import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'
import { createSwitch, island, setSwitchBehaviour } from '#tests/helpers/components/behaviours'

const editor = useEditorSetup()
const deck = deckDriver(() => editor.page)

test.afterEach(async () => {
  await deck.stopPresenting()
  await deck.close()
})

/** The slide on show and the steps of its build played. */
async function where() {
  const status = await deck.presentation()
  return status && { index: status.index, played: status.played }
}

test('a deck plays its steps and slides from the keyboard, goes back, and ends on Escape', async () => {
  const [first] = await deck.open([3])
  await deck.addAnimatedBox(first)
  await deck.select([first])
  await editor.page.getByTestId('slides-present').click()
  await editor.page.getByTestId('slides-present-start').click()
  await expect(editor.page.getByTestId('slides-presentation')).toBeVisible()
  expect(await where()).toEqual({ index: 0, played: 0 })
  await editor.page.keyboard.press('ArrowRight')
  await expect.poll(where).toEqual({ index: 0, played: 1 })
  await editor.page.keyboard.press('Space')
  await expect.poll(where).toEqual({ index: 1, played: 0 })
  await editor.page.keyboard.press('ArrowLeft')
  await expect.poll(where).toEqual({ index: 0, played: 1 })
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByTestId('slides-presentation')).toBeHidden()
  expect(await where()).toBeNull()
})

test('a control on a slide stays live while the deck is presented', async () => {
  const [first] = await deck.open([1])
  const ids = await createSwitch(editor.page)
  await setSwitchBehaviour(editor.page, ids.setId)
  await deck.placeOnSlide(ids.instanceId, first, 400, 300)
  await deck.present(first)
  const control = island(editor.page, ids.instanceId).getByRole('switch')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  await control.click()
  await expect(control).toHaveAttribute('aria-checked', 'true')
  // The click worked the control; it did not move the deck on.
  expect(await where()).toEqual({ index: 0, played: 0 })
  // Nor do keys pressed on it.
  await control.press('Space')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  expect(await where()).toEqual({ index: 0, played: 0 })
})

test('a control stays live once a layer beside it has animated away', async () => {
  const [first] = await deck.open([2])
  const ids = await createSwitch(editor.page, { nested: true })
  await setSwitchBehaviour(editor.page, ids.setId)
  await deck.placeOnSlide(ids.islandId, first, 400, 300)
  await deck.addExitingBox(ids.islandId)
  await deck.present(first)
  await editor.page.keyboard.press('ArrowRight')
  await expect.poll(where).toEqual({ index: 0, played: 1 })
  const control = island(editor.page, ids.islandId).getByRole('switch')
  await control.click()
  await expect(control).toHaveAttribute('aria-checked', 'true')
  expect(await where()).toEqual({ index: 0, played: 1 })
  // The layer that left is drawn transparent in the live island, not shown again.
  await expect(island(editor.page, ids.islandId).locator('[data-layer="Leaving"]')).toHaveCSS(
    'opacity',
    '0'
  )
})

test("the presenter's window shows the notes and moves the deck", async () => {
  const [first] = await deck.open([2])
  await deck.setNotes(first, 'Open with the numbers')
  await deck.select([first])
  await editor.page.getByTestId('slides-present').click()
  const [presenter] = await Promise.all([
    editor.page.context().waitForEvent('page'),
    editor.page.getByTestId('slides-present-notes').click()
  ])
  await expect(presenter.getByTestId('presenter-counter')).toHaveText('1 of 2')
  await expect(presenter.getByTestId('presenter-notes')).toHaveText('Open with the numbers')
  await presenter.keyboard.press('ArrowRight')
  await expect.poll(where).toEqual({ index: 1, played: 0 })
  await expect(presenter.getByTestId('presenter-counter')).toHaveText('2 of 2')
  await presenter.keyboard.press('Escape')
  await expect(editor.page.getByTestId('slides-presentation')).toBeHidden()
  await expect(presenter.getByText('The presentation has ended')).toBeVisible()
  await presenter.close()
})

test('the Animate tab sets the transition of the slide on the stage', async () => {
  const [first] = await deck.open([2])
  await deck.show(first)
  await editor.page.getByTestId('properties-tab-animate').click()
  await editor.page.getByTestId('animate-add-transition').click()
  await editor.page.locator('[data-property=animate-transition-style]').click()
  await editor.page.getByRole('option', { name: 'Push' }).click()
  await editor.page
    .locator('[data-property=animate-transition-direction]')
    .getByRole('button', { name: 'Up' })
    .click()
  expect(await deck.transitionStyle(first)).toBe('PUSH_FROM_BOTTOM')
  await editor.page.getByTestId('properties-tab-design').click()
})

test("a design's selected frames present as slides without making it a deck", async () => {
  const frames = await deck.addFrames([600, 0, 1200], 2)
  await editor.page.getByTestId('slides-present').click()
  await editor.page.getByTestId('slides-present-frames').click()
  await expect(editor.page.getByTestId('slides-presentation')).toBeVisible()
  expect((await deck.presentation())?.slideIds).toEqual([frames[1], frames[0]])
  await editor.page.keyboard.press('Escape')
  await deck.remove(frames)
})
