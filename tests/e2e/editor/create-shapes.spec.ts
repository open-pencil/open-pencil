import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('empty canvas', async () => {
  await expectCanvas('empty-canvas')
})

test('draw rectangle', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await expectCanvas('draw-rectangle')
})

test('draw ellipse', async () => {
  await editor.canvas.drawEllipse(100, 100, 200, 150)
  await expectCanvas('draw-ellipse')
})

test('draw rectangle then move it', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.selectTool('select')
  await editor.canvas.drag(200, 175, 400, 300)
  await editor.canvas.waitForRender()
  await expectCanvas('draw-rectangle-then-move-it')
})

test('draw and delete', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.deleteSelection()
  await expectCanvas('draw-and-delete')
})

test('draw and undo', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.undo()
  await expectCanvas('draw-and-undo')
})
