import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { openAppMenu } from '#tests/helpers/menu'

const editor = useEditorSetup('/?test')

test.beforeAll(async () => {
  await editor.page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('browser menu copy writes rich and plain OpenPencil clipboard formats', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 120, 80)
  await editor.canvas.waitForRender()

  const copyMenu = await openAppMenu(editor.page, 'Edit')
  await copyMenu.getByRole('menuitem', { name: /^Copy/ }).click()

  // Copy writes once the document is encoded; until then the clipboard is empty, and a read that
  // overlaps the write fails because the data changed under it.
  const readClipboard = () =>
    editor.page.evaluate(async () => {
      try {
        const [item] = await navigator.clipboard.read()
        if (!item) return { types: [], html: '', plainText: '' }
        const html = item.types.includes('text/html')
          ? await (await item.getType('text/html')).text()
          : ''
        const plainText = item.types.includes('text/plain')
          ? await (await item.getType('text/plain')).text()
          : ''
        return { types: item.types, html, plainText }
      } catch {
        return { types: [], html: '', plainText: '' }
      }
    })
  await expect.poll(async () => (await readClipboard()).types).toContain('text/html')
  const clipboard = await readClipboard()

  expect(clipboard.types).toContain('text/html')
  expect(clipboard.types).toContain('text/plain')
  expect(clipboard.html).toContain('data-buffer="&lt;!--(figma)')
  expect(clipboard.plainText).not.toBe('')

  const before = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).length
  })
  const pasteMenu = await openAppMenu(editor.page, 'Edit')
  await pasteMenu.getByRole('menuitem', { name: /^Paste\s+(?:⌘|Ctrl)/ }).click()
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
