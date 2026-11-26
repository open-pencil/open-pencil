import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { deckDriver } from '#tests/helpers/canvas/deck-driver'

const editor = useEditorSetup('/?test&no-chrome')
const deck = deckDriver(() => editor.page)

test.afterEach(() => deck.close())

test('Slide view shows only its slide, clipped, with the rulers counting from its corner', async () => {
  const [first] = await deck.open([2])
  await deck.addBoxPastRightEdge(first)
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
  await deck.select([ids[1]])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(900, 600)).toMatchSnapshot('grid-view.png')
})

test('a presented slide fills the screen on black, clipped, with layers its build holds back hidden', async () => {
  const [first] = await deck.open([2])
  await deck.addBoxPastRightEdge(first)
  await editor.page.evaluate((slideId) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const held = store.graph.createNode('ELLIPSE', slideId, {
      name: 'Held back',
      x: 200,
      y: 200,
      width: 300,
      height: 300,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 1, a: 1 }, opacity: 1, visible: true }]
    })
    store.addLayerAnimations([held.id])
    store.present(slideId)
  }, first)
  const presentation = editor.page.getByTestId('slides-presentation')
  await expect(presentation).toHaveScreenshot('presentation.png')
  await editor.page.evaluate(() => window.openPencil?.getStore?.().stopPresenting())
})
