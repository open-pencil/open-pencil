import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

test.use({ viewport: { width: 900, height: 700 } })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('collaborator cursor names are shaped and long names end with an ellipsis', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const red = { r: 0.92, g: 0.34, b: 0.29, a: 1 }
    const blue = { r: 0.2, g: 0.55, b: 0.95, a: 1 }
    store.state.panX = 0
    store.state.panY = 0
    store.state.zoom = 1
    store.state.presenceCursors = [
      { kind: 'person', name: 'Orbit', color: blue, x: 80, y: 80 },
      { kind: 'person', name: 'Ava Yoder', color: red, x: 80, y: 160 },
      {
        kind: 'person',
        name: 'A collaborator with a very long display name',
        color: blue,
        x: 80,
        y: 240
      }
    ]
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(400, 320)).toMatchSnapshot('cursor-labels.png')
})
