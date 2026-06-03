import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/demo?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.canvas.screenshot()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('demo effects section showcases renderer features', async () => {
  await editor.page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    store.state.zoom = 0.82
    store.state.panX = 8
    store.state.panY = -556
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  await expectCanvas('demo-effects-section')
})
