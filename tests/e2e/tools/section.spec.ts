import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

test('draw section in full editor without browser errors', async () => {
  await editor.canvas.drawSection(100, 100, 240, 160)

  await expect(editor.page.getByTestId('design-node-header')).toContainText('SECTION')
  await expect
    .poll(async () => {
      return editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        const selectedId = [...store.state.selectedIds][0]
        return selectedId ? store.graph.getNode(selectedId)?.type : null
      })
    })
    .toBe('SECTION')

  editor.canvas.assertNoErrors()
})
