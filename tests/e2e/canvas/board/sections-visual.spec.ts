import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { boardDriver } from '#tests/helpers/canvas/board-driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const board = boardDriver(() => editor.page)

test.afterEach(() => board.close())

// Measured in FigJam: a section's title is a pill in its outline colour, with white text on the
// darkest palette colours and black on the rest.
test('a board titles its sections in their outline colours, as FigJam does', async () => {
  await board.open()
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const sections = [
      { name: 'Red', color: 'red', x: 32 },
      { name: 'Yellow', color: 'yellow', x: 224 },
      { name: 'Light blue', color: 'lightBlue', x: 416 }
    ] as const
    for (const { name, color, x } of sections) {
      const id = store.createShape('SECTION', x, 48, 160, 64)
      store.graph.updateNode(id, { name })
      store.setFigJamColor([id], color)
    }
    store.select([])
    store.requestRender()
  })
  await board.showAt(1)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(600, 140)).toMatchSnapshot(
    'board-section-titles.png'
  )
})
