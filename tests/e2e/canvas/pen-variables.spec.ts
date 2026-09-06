import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-chrome&no-rulers')

test('renders imported .pen variable colors and fonts like literal values', async () => {
  await editor.page.evaluate(() =>
    window.openPencil?.openFile?.('/tests/fixtures/pen-variables.pen')
  )
  await editor.canvas.waitForInit()
  expect(
    await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return ['literal-text', 'plain-text', 'dashed-text'].map(
        (id) => store?.graph.getNode(id)?.fontFamily
      )
    })
  ).toEqual(['Noto Naskh Arabic', 'Noto Naskh Arabic', 'Noto Naskh Arabic'])
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    store.clearSelection()
    store.requestRender()
  })
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  expect(await editor.canvas.screenshotCanvasRegion(860, 300)).toMatchSnapshot(
    'pen-variable-colors-and-fonts.png'
  )
})
