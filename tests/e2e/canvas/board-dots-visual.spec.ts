import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

// Figma desktop, FigJam board: #C4C4C4 dots, 2 units across, every 16 units from 50% and
// every 32 at 25%, under the layers.
for (const zoom of [1, 0.25]) {
  test(`a board draws FigJam's dots under its layers at ${zoom * 100}%`, async () => {
    await editor.page.evaluate((zoom) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.setDocumentKind('board')
      store.state.pageColor = { r: 245 / 255, g: 245 / 255, b: 245 / 255, a: 1 }
      store.createShape('RECTANGLE', 40, 40, 96, 64)
      store.state.zoom = zoom
      store.state.panX = 0
      store.state.panY = 0
      store.requestRender()
    }, zoom)
    await editor.canvas.waitForRender()
    editor.canvas.assertNoErrors()
    expect(await editor.canvas.screenshotCanvasRegion(200, 140)).toMatchSnapshot(
      `board-dots-${zoom * 100}.png`
    )
  })
}
