import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'
import { createSwitch, island } from '#tests/helpers/components/behaviours'

const editor = useEditorSetup()
const deck = deckDriver(() => editor.page)

test.afterEach(async () => {
  await editor.page.evaluate(() => window.openPencil?.getStore?.().stopPresenting())
  await deck.close()
})

/** Where the presentation is: the slide on show and the steps of its build played. */
function presentation() {
  return editor.page.evaluate(() => {
    const status = window.openPencil?.getStore?.().state.presentation
    return status ? { index: status.index, played: status.played } : null
  })
}

/** Animates a new box onto `slideId` on a click, and returns its ID. */
function addAnimatedBox(slideId: string) {
  return editor.page.evaluate((slideId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const box = store.graph.createNode('RECTANGLE', slideId, {
      name: 'Box',
      width: 200,
      height: 200
    })
    store.addLayerAnimations([box.id])
    return box.id
  }, slideId)
}

test('a deck plays its steps and slides from the keyboard, goes back, and ends on Escape', async () => {
  const [first] = await deck.open([3])
  await addAnimatedBox(first)
  await deck.select([first])
  await editor.page.getByTestId('slides-present').click()
  await editor.page.getByTestId('slides-present-start').click()
  await expect(editor.page.getByTestId('slides-presentation')).toBeVisible()
  expect(await presentation()).toEqual({ index: 0, played: 0 })
  await editor.page.keyboard.press('ArrowRight')
  await expect.poll(presentation).toEqual({ index: 0, played: 1 })
  await editor.page.keyboard.press('Space')
  await expect.poll(presentation).toEqual({ index: 1, played: 0 })
  await editor.page.keyboard.press('ArrowLeft')
  await expect.poll(presentation).toEqual({ index: 0, played: 1 })
  await editor.page.keyboard.press('Escape')
  await expect(editor.page.getByTestId('slides-presentation')).toBeHidden()
  expect(await presentation()).toBeNull()
})

test('a control on a slide stays live while the deck is presented', async () => {
  const [first] = await deck.open([1])
  const ids = await createSwitch(editor.page)
  await editor.page.evaluate(
    ({ setId, instanceId, slideId }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setBehaviour(setId, {
        kind: 'switch',
        booleans: { value: { propertyId: 'state', on: 'On', off: 'Off' } },
        texts: {},
        numbers: {},
        parts: {}
      })
      store.graph.reparentNode(instanceId, slideId)
      store.graph.updateNode(instanceId, { x: 400, y: 300 })
      store.present(slideId)
    },
    { ...ids, slideId: first }
  )
  const control = island(editor.page, ids.instanceId).getByRole('switch')
  await expect(control).toHaveAttribute('aria-checked', 'false')
  await control.click()
  await expect(control).toHaveAttribute('aria-checked', 'true')
  // The click worked the control; it did not move the deck on.
  expect(await presentation()).toEqual({ index: 0, played: 0 })
})

test("the presenter's window shows the notes and moves the deck", async () => {
  const [first] = await deck.open([2])
  await editor.page.evaluate(
    (id) => window.openPencil?.getStore?.().setSlideNotes(id, 'Open with the numbers'),
    first
  )
  await deck.select([first])
  await editor.page.getByTestId('slides-present').click()
  const [presenter] = await Promise.all([
    editor.page.context().waitForEvent('page'),
    editor.page.getByTestId('slides-present-notes').click()
  ])
  await expect(presenter.getByTestId('presenter-counter')).toHaveText('1 of 2')
  await expect(presenter.getByTestId('presenter-notes')).toHaveText('Open with the numbers')
  await presenter.keyboard.press('ArrowRight')
  await expect.poll(presentation).toEqual({ index: 1, played: 0 })
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
  const style = await editor.page.evaluate(
    (id) => window.openPencil?.getStore?.().graph.getNode(id)?.slide?.transition?.style,
    first
  )
  expect(style).toBe('PUSH_FROM_BOTTOM')
  await editor.page.getByTestId('properties-tab-design').click()
})
