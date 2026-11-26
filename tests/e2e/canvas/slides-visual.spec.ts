import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'

const editor = useEditorSetup('/?test&no-chrome')
const deck = deckDriver(() => editor.page)

test.afterEach(() => deck.close())

test('Slide view shows only its slide, clipped, with the rulers counting from its corner', async () => {
  const [first] = await deck.open([2])
  await editor.page.evaluate((slideId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    // Past the slide's right edge, where the next slide starts in the grid.
    const id = store.graph.createNode('RECTANGLE', slideId, {
      x: 1500,
      y: 300,
      width: 800,
      height: 400,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.3, b: 0.2, a: 1 }, opacity: 1, visible: true }]
    }).id
    store.select([id])
  }, first)
  await deck.show(first)
  await deck.place(0.3, 40, 60)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(900, 600)).toMatchSnapshot('slide-view.png')
})

test('Grid view numbers its slides and outlines a selected one without handles', async () => {
  const ids = await deck.open([3, 1])
  await deck.show(null)
  await deck.place(0.1, 40, 60)
  await editor.page.evaluate((id) => {
    window.openPencil?.getStore?.().select([id])
  }, ids[1])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(900, 600)).toMatchSnapshot('grid-view.png')
})
