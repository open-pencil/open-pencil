import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function canvasBox() {
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounds unavailable')
  return box
}

async function pencilState() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const vectors = store.graph
      .getChildren(store.state.currentPageId)
      .filter((node) => node.type === 'VECTOR')
      .map((node) => ({
        vertices: node.vectorNetwork?.vertices.length ?? 0,
        y: node.vectorNetwork?.vertices.map((vertex) => vertex.y),
        strokes: node.strokes.length,
        fills: node.fills.length
      }))
    return { tool: store.state.activeTool, selected: store.state.selectedIds.size, vectors }
  })
}

test('Shift+P draws freehand strokes and stays on the pencil', async () => {
  const box = await canvasBox()
  await editor.page.mouse.click(box.x + 40, box.y + 40)
  await editor.page.keyboard.press('Shift+KeyP')

  await editor.page.mouse.move(box.x + 120, box.y + 200)
  await editor.page.mouse.down()
  for (let i = 1; i <= 60; i++) {
    await editor.page.mouse.move(
      box.x + 120 + 5 * i,
      box.y + 200 + 40 * Math.sin((i / 60) * 2 * Math.PI)
    )
  }
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('pencil-live-stroke.png')
  await editor.page.mouse.up()

  // Shift draws straight along the nearer axis.
  await editor.page.mouse.move(box.x + 120, box.y + 320)
  await editor.page.mouse.down()
  await editor.page.keyboard.down('Shift')
  await editor.page.mouse.move(box.x + 300, box.y + 350, { steps: 10 })
  await editor.page.keyboard.up('Shift')
  await editor.page.mouse.up()

  const state = await pencilState()
  expect(state.tool).toBe('PENCIL')
  expect(state.selected).toBe(0)
  expect(state.vectors).toHaveLength(2)
  expect(state.vectors[0]).toMatchObject({ strokes: 1, fills: 0 })
  expect(state.vectors[0].vertices).toBeGreaterThan(2)
  expect(state.vectors[1]).toMatchObject({ vertices: 2, y: [0, 0] })
})

test('a click without dragging draws nothing', async () => {
  const box = await canvasBox()
  await editor.page.mouse.click(box.x + 40, box.y + 40)
  await editor.page.keyboard.press('Shift+KeyP')
  await editor.page.mouse.click(box.x + 200, box.y + 200)
  expect((await pencilState()).vectors).toHaveLength(0)
})
