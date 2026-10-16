import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

test('draw section in full editor without browser errors', async () => {
  await editor.canvas.drawSection(100, 100, 240, 160)

  await expect(editor.page.getByRole('button', { name: 'Layer type', exact: true })).toBeEnabled()
  await expect
    .poll(async () => {
      return editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const selectedId = [...store.state.selectedIds][0]
        const node = selectedId ? store.graph.getNode(selectedId) : null
        return node ? { type: node.type, width: node.width, height: node.height } : null
      })
    })
    .toEqual({ type: 'SECTION', width: 240, height: 160 })

  editor.canvas.assertNoErrors()
})
