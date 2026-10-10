import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

test('selection chrome, size pill and ruler badges follow the accent color', async () => {
  const { page, canvas } = editor
  await page.getByTestId('app-settings-trigger').click()
  await page
    .getByRole('radiogroup', { name: 'Accent color', exact: true })
    .getByRole('radio', { name: 'Green', exact: true })
    .click()
  await page.getByTestId('app-settings-done').click()

  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const rectangle = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      name: 'Card',
      x: 160,
      y: 140,
      width: 240,
      height: 160,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.select([rectangle.id])
  })
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion(560, 420)).toMatchSnapshot('green-selection.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
})
