import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-chrome&no-rulers')

/**
 * The sticker's text on a path, selected, with the illustration it curves around hidden: the
 * snapshot is of the text and its overlay, not of artwork that would make it a large image.
 */
async function selectPathText(editing: boolean) {
  await editor.page.evaluate(() => window.openPencil?.openFile?.('/tests/fixtures/circle-text.fig'))
  await editor.canvas.waitForRender()
  return editor.page.evaluate((edit) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const nodes = [...store.graph.getAllNodes()]
    for (const artwork of nodes.filter((node) => node.name === 'back' || node.name === 'ArnoIcon'))
      store.graph.updateNode(artwork.id, { visible: false })
    const node = nodes.find((candidate) => candidate.name === 'ArnoCoenen.art')
    if (!node) return null
    store.select([node.id])
    // At half size near the corner, so a small region holds the text, its overlay, and its label.
    const bounds = store.graph.getAbsoluteBounds(node.id)
    store.state.zoom = 0.5
    store.state.panX = 30 - bounds.x * 0.5
    store.state.panY = 40 - bounds.y * 0.5
    if (edit) {
      store.startTextEditing(node.id)
      const text = store.textEditor
      if (!text) return null
      text.selectWord(0)
      store.textSelectionChanged()
    }
    store.requestRender()
    return store.textEditor?.getSelectionRange() ?? []
  }, editing)
}

test('renders imported text on a path with its selection overlay', async () => {
  test.setTimeout(90_000)
  expect(await selectPathText(false)).toEqual([])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  const buffer = await editor.canvas.screenshotCanvasRegion(340, 360)
  expect(buffer).toMatchSnapshot('text-path-rendering-and-selection.png')
})

test('selects characters along text on a path while editing it', async () => {
  test.setTimeout(90_000)
  expect(await selectPathText(true)).toEqual([0, 10])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  const buffer = await editor.canvas.screenshotCanvasRegion(340, 360)
  expect(buffer).toMatchSnapshot('text-path-editing-selection.png')
})
