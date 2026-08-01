import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

/**
 * First end-to-end coverage of the slides editor + presentation mode.
 *
 * Builds the deck in-app (New Deck + filmstrip) rather than a Git LFS fixture.
 * Asserts presentation state and layout — never document.fullscreenElement
 * (headless browsers do not grant real fullscreen).
 */

const editor = useEditorSetup('/?test')

function getPresentationState() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pages = store.graph.getPages()
    const index = pages.findIndex((page) => page.id === store.state.currentPageId)
    return {
      presenting: store.state.presenting,
      documentKind: store.state.documentKind,
      pageCount: pages.length,
      slideIndex: index,
      currentPageId: store.state.currentPageId,
      selectedCount: store.state.selectedIds.size,
      canUndo: store.undo.canUndo,
      zoom: store.state.zoom,
      showUI: store.state.showUI
    }
  })
}

async function createDeck() {
  await editor.page.locator('[role="menubar"] [role="menuitem"]', { hasText: 'File' }).click()
  await editor.page.locator('[role="menu"] [role="menuitem"]', { hasText: 'New Deck' }).click()
  // Wait for the *new* deck, not merely for a filmstrip. When a deck is already open the
  // filmstrip is visible before New Deck resolves, so waiting on visibility returns
  // instantly and races the incoming tab. A fresh deck has exactly one slide.
  await expect(editor.page.getByTestId('slides-filmstrip').getByRole('listitem')).toHaveCount(1, {
    timeout: 15000
  })
  await editor.canvas.waitForInit()
}

async function addSlide() {
  await editor.page.getByTestId('slides-new').click()
  await editor.canvas.waitForRender()
}

async function selectSlide(index: number) {
  const cells = editor.page.getByTestId('slides-filmstrip').getByRole('listitem')
  await cells.nth(index).click()
  await editor.canvas.waitForRender()
}

async function enterPresentation() {
  // Keyboard entry (spec path). Avoids flaky hits on the right splitter handle.
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  await editor.page.keyboard.press(`Alt+${mod}+Enter`)
  await expect(editor.page.getByTestId('presentation-stage')).toHaveAttribute(
    'data-presenting',
    'true',
    { timeout: 5000 }
  )
}

test('present control is absent for a design document', async () => {
  // Default ?test start is a design document.
  await expect(editor.page.getByTestId('present-button')).toHaveCount(0)
  const state = await getPresentationState()
  expect(state.documentKind).toBe('design')
})

test('present control is shown for a deck', async () => {
  await createDeck()
  await expect(editor.page.getByTestId('present-button')).toBeVisible()
  const state = await getPresentationState()
  expect(state.documentKind).toBe('deck')
  expect(state.pageCount).toBe(1)
})

test('entering on slide 2 starts on slide 2 with chrome hidden and position indicator', async () => {
  await addSlide()
  await addSlide()
  // Three slides: indices 0, 1, 2. Select slide 2 (index 1).
  await selectSlide(1)

  let state = await getPresentationState()
  expect(state.pageCount).toBe(3)
  expect(state.slideIndex).toBe(1)

  await enterPresentation()

  state = await getPresentationState()
  expect(state.presenting).toBe(true)
  expect(state.slideIndex).toBe(1)
  expect(state.selectedCount).toBe(0)

  // Editing chrome is covered / replaced by the stage; filmstrip is not interactive on top.
  await expect(editor.page.getByTestId('presentation-stage')).toBeVisible()
  await expect(editor.page.getByTestId('presentation-position')).toHaveText('2 / 3')
  await expect(editor.page.getByTestId('presentation-catcher')).toBeVisible()

  // Deck name is available while presenting, in its own region above the slide.
  await expect(editor.page.getByTestId('presentation-top-bar')).toBeAttached()
  await expect(editor.page.getByTestId('presentation-title')).not.toBeEmpty()

  // The canvas must fill the stage *while presenting*, not merely survive the round
  // trip. A broken flex chain leaves it zero-height and the stage renders black —
  // which every other assertion here passes straight through.
  const viewport = expectDefined(editor.page.viewportSize())
  const presentingBox = expectDefined(await editor.page.getByTestId('canvas-element').boundingBox())
  expect(presentingBox.height).toBeGreaterThan(viewport.height * 0.9)
  expect(presentingBox.width).toBeGreaterThan(viewport.width * 0.9)

  // Toolbar is not mounted while presenting.
  await expect(editor.page.getByTestId('toolbar')).toHaveCount(0)
})

test('arrow, space and click advance; left goes back; End and Home jump', async () => {
  // Start from slide 2 of 3 (index 1) still presenting from previous test.
  let state = await getPresentationState()
  expect(state.presenting).toBe(true)
  expect(state.slideIndex).toBe(1)

  await editor.page.keyboard.press('ArrowRight')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(2)
  await expect(editor.page.getByTestId('presentation-position')).toHaveText('3 / 3')

  await editor.page.keyboard.press('ArrowLeft')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(1)

  await editor.page.keyboard.press('Space')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(2)

  await editor.page.keyboard.press('Home')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(0)
  await expect(editor.page.getByTestId('presentation-position')).toHaveText('1 / 3')

  await editor.page.keyboard.press('End')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(2)

  // Click catcher advances — already on last, stays put (covered next); go Home first.
  await editor.page.keyboard.press('Home')
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('presentation-catcher').click()
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(1)
})

test('advancing on the last slide stays put; single-slide deck does not exit', async () => {
  await editor.page.keyboard.press('End')
  await editor.canvas.waitForRender()
  let state = await getPresentationState()
  expect(state.slideIndex).toBe(2)

  await editor.page.keyboard.press('ArrowRight')
  await editor.page.keyboard.press('Space')
  await editor.page.keyboard.press('PageDown')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.presenting).toBe(true)
  expect(state.slideIndex).toBe(2)

  // Exit, build a one-slide deck path: new deck already has one slide.
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.presenting).toBe(false)

  await createDeck()
  await enterPresentation()
  state = await getPresentationState()
  expect(state.pageCount).toBe(1)
  expect(state.presenting).toBe(true)

  await editor.page.keyboard.press('ArrowRight')
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.presenting).toBe(true)
  expect(state.slideIndex).toBe(0)
})

test('Escape exits, restores chrome, and leaves the document unmodified', async () => {
  const before = await getPresentationState()
  expect(before.presenting).toBe(true)
  const canUndoBefore = before.canUndo

  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  const after = await getPresentationState()
  expect(after.presenting).toBe(false)
  expect(after.canUndo).toBe(canUndoBefore)

  // Chrome restored: present button and filmstrip visible again.
  await expect(editor.page.getByTestId('present-button')).toBeVisible()
  await expect(editor.page.getByTestId('slides-filmstrip')).toBeVisible()
  await expect(editor.page.getByTestId('presentation-catcher')).toHaveCount(0)
})

test('canvas still renders after exiting presentation', async () => {
  // Re-enter and exit once more, then assert the WebGL canvas is still alive.
  await enterPresentation()
  await expect(editor.page.getByTestId('presentation-stage')).toHaveAttribute(
    'data-presenting',
    'true'
  )
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  const canvas = editor.page.getByTestId('canvas-element')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAttribute('data-ready', '1')

  // A live surface still reports non-zero size after the teleport round-trip.
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  expect(box?.width ?? 0).toBeGreaterThan(100)
  expect(box?.height ?? 0).toBeGreaterThan(100)

  const state = await getPresentationState()
  expect(state.presenting).toBe(false)
  // Zoom re-fit for editing after exit (not stuck at 0).
  expect(state.zoom).toBeGreaterThan(0)
})

test('chrome reveals on the bottom band and the pill navigates', async () => {
  // Previous test left a fresh single-slide deck, not presenting. Two slides are needed
  // to exercise both ends of the pill.
  await addSlide()
  await selectSlide(0)
  await enterPresentation()

  const viewport = expectDefined(editor.page.viewportSize())
  const chrome = editor.page.getByTestId('presentation-chrome')
  const topBar = editor.page.getByTestId('presentation-top-bar')

  // Away from the top the chrome stays away, even after the entry linger has passed.
  await editor.page.mouse.move(viewport.width / 2, viewport.height / 2)
  await expect(chrome).toHaveAttribute('data-chrome-visible', 'false')
  await expect(topBar).toHaveAttribute('data-chrome-visible', 'false')
  // The bottom is not a trigger — only the top band is.
  await editor.page.mouse.move(viewport.width / 2, viewport.height - 20)
  await expect(chrome).toHaveAttribute('data-chrome-visible', 'false')
  // Reaching the top brings back both regions together.
  await editor.page.mouse.move(viewport.width / 2, 20)
  await expect(topBar).toHaveAttribute('data-chrome-visible', 'true')
  await expect(chrome).toHaveAttribute('data-chrome-visible', 'true')

  const previous = editor.page.getByTestId('presentation-previous')
  const next = editor.page.getByTestId('presentation-next')

  // No wrapping, so the arrows go dead at the ends rather than silently doing nothing.
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()

  await next.click()
  await editor.canvas.waitForRender()
  let state = await getPresentationState()
  expect(state.slideIndex).toBe(1)
  await expect(next).toBeDisabled()
  await expect(previous).toBeEnabled()

  await previous.click()
  await editor.canvas.waitForRender()
  state = await getPresentationState()
  expect(state.slideIndex).toBe(0)

  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
})
