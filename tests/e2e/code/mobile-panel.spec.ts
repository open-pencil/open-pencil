import { test, expect, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.use({ viewport: { width: 390, height: 844 } })

test('closed mobile Code drawer defers JSX until reopened', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const frameId = store.createShape('FRAME', 0, 0, 100, 100)
    store.select([frameId])
  })

  await editor.page.getByTestId('mobile-ribbon-code').click()
  await expect(editor.page.getByTestId('code-panel')).toBeVisible()

  await editor.page.getByTestId('mobile-ribbon-code').click()
  await expect
    .poll(() => editor.page.evaluate(() => window.openPencil?.getStore?.().state.mobileDrawerSnap))
    .toBe('closed')

  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.clearSelection()
    const rectangleId = store.createShape('RECTANGLE', 120, 0, 100, 100)
    store.select([rectangleId])
  })

  await editor.page.getByTestId('mobile-ribbon-code').click()
  await expect(editor.page.getByTestId('code-panel')).toContainText('Rectangle')
})
