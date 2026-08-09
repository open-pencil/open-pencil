import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

/**
 * Drag-to-reorder in the slides filmstrip.
 *
 * Slide order IS page order, so this asserts the graph's page order rather than
 * the rendered strip: the numbers beside each thumbnail are positional labels
 * and would read 1..n whatever the underlying order.
 */

// `/editor`, not `/` — `/` is the workspace. `?test` suppresses the blank-start demo.
const editor = useEditorSetup('/editor?test')

function slideCells() {
  return editor.page.getByTestId('slides-filmstrip').getByRole('listitem')
}

function getPageOrder() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      names: store.graph.getPages().map((page) => page.name),
      currentPageId: store.state.currentPageId
    }
  })
}

async function createDeck() {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'File' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'New Deck' }).click()
  await expect(slideCells()).toHaveCount(1, { timeout: 15000 })
  await editor.canvas.waitForInit()
}

/** Three named slides, with slide 2 current so we can prove selection survives. */
async function threeNamedSlides() {
  const currentPageId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    while (store.graph.getPages().length < 3) store.addPage()
    for (const [index, page] of store.graph.getPages().entries()) {
      store.renamePage(page.id, `Slide ${index + 1}`)
    }
    const page = store.graph.getPages()[1]
    if (!page) throw new Error('Expected at least three slides')
    store.switchPage(page.id)
    return page.id
  })
  await editor.canvas.waitForRender()
  await expect(slideCells()).toHaveCount(3)
  return currentPageId
}

test('dragging a slide thumbnail reorders the deck', async () => {
  await createDeck()
  const currentPageId = await threeNamedSlides()

  await slideCells()
    .first()
    .dragTo(slideCells().nth(2), {
      targetPosition: { x: 12, y: 18 }
    })
  await editor.canvas.waitForRender()

  const { names, currentPageId: currentAfter } = await getPageOrder()
  expect(names).toEqual(['Slide 2', 'Slide 3', 'Slide 1'])
  // Reordering moves slides, it does not change which one you are editing.
  expect(currentAfter).toBe(currentPageId)

  editor.canvas.assertNoErrors()
})

test('dropping a slide back on itself leaves the order alone', async () => {
  await createDeck()
  await threeNamedSlides()

  await slideCells().nth(1).dragTo(slideCells().nth(1))
  await editor.canvas.waitForRender()

  const { names } = await getPageOrder()
  expect(names).toEqual(['Slide 1', 'Slide 2', 'Slide 3'])

  editor.canvas.assertNoErrors()
})
