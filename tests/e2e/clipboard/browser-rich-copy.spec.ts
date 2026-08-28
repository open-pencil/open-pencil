import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test')

test.beforeAll(async () => {
  await editor.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('browser menu copy writes rich and plain OpenPencil clipboard formats', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 120, 80)
  await editor.canvas.waitForRender()

  await editor.page.getByTestId('menubar-edit').click()
  await editor.page.getByRole('menuitem', { name: /^Copy/ }).click()

  const clipboard = await editor.page.evaluate(async () => {
    const items = await navigator.clipboard.read()
    const item = items[0]
    if (!item) return { types: [], html: '', plainText: '' }
    const html = item.types.includes('text/html')
      ? await (await item.getType('text/html')).text()
      : ''
    const plainText = item.types.includes('text/plain')
      ? await (await item.getType('text/plain')).text()
      : ''
    return { types: item.types, html, plainText }
  })

  expect(clipboard.types).toContain('text/html')
  expect(clipboard.types).toContain('text/plain')
  expect(clipboard.html).toContain('data-buffer="&lt;!--(figma)')
  expect(clipboard.plainText).not.toBe('')

  const before = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
  await editor.page.getByTestId('menubar-edit').click()
  await editor.page.getByRole('menuitem', { name: /^Paste\s+(?:⌘|Ctrl)/ }).click()
  await expect
    .poll(() =>
      editor.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return store.graph.getChildren(store.state.currentPageId).length
      })
    )
    .toBe(before + 1)
})
