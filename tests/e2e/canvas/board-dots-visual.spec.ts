import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { boardDriver } from '#tests/helpers/canvas/board-driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const board = boardDriver(() => editor.page)

test.afterEach(() => board.close())

// Figma desktop, FigJam board: #C4C4C4 dots, 2 units across, every 16 units from 50% and
// every 32 at 25%, under the layers.
for (const zoom of [1, 0.25]) {
  test(`a board draws FigJam's dots under its layers at ${zoom * 100}%`, async () => {
    await board.open()
    await board.addRectangle(40, 40, 96, 64)
    await board.showAt(zoom)
    await editor.canvas.waitForRender()
    editor.canvas.assertNoErrors()
    expect(await editor.canvas.screenshotCanvasRegion(200, 140)).toMatchSnapshot(
      `board-dots-${zoom * 100}.png`
    )
  })
}
