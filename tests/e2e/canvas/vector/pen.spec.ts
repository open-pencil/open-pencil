import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

// Figma desktop 126: continuing a path, the point the pen draws from is solid, the segment to the
// cursor is blue, and a cursor within 4 pixels of a vertex's y snaps to it with a guide.
test('the pen previews a continued path and lines the next point up with its vertices', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const straight = { tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
    const vector = store.graph.createNode('VECTOR', store.state.currentPageId, {
      name: 'Open path',
      x: 100,
      y: 80,
      width: 200,
      height: 120,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          align: 'CENTER',
          weight: 1
        }
      ],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 120 },
          { x: 100, y: 0 },
          { x: 200, y: 120 }
        ],
        segments: [
          { start: 0, end: 1, ...straight },
          { start: 1, end: 2, ...straight }
        ],
        regions: []
      }
    })
    store.enterNodeEditMode(vector.id)
    store.setTool('PEN')
  })
  await editor.canvas.waitForRender()
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')

  await editor.page.mouse.click(box.x + 300, box.y + 200)
  await editor.page.mouse.move(box.x + 380, box.y + 83)
  await editor.canvas.waitForRender()

  const state = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    return {
      cursor: [store?.state.penCursorX, store?.state.penCursorY],
      guides: store?.state.snapGuides
    }
  })
  expect(state.cursor).toEqual([380, 80])
  expect(state.guides).toEqual([{ axis: 'y', position: 80, from: 200, to: 380, marks: [380, 200] }])
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('pen-continue-guide.png')
})
