import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetup()

function pageColor() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.state.pageColor
  })
}

test('page background uses the shared paint field for hex and alpha', async () => {
  const pageSection = propertySection(editor.page, 'Page')
  await expect(pageSection).toBeVisible()

  const hex = pageSection.getByRole('textbox', { name: 'Page background' })
  await hex.fill('336699')
  await hex.press('Enter')
  await editor.canvas.waitForRender()

  let color = await pageColor()
  expect(color.r).toBeCloseTo(0.2, 2)
  expect(color.g).toBeCloseTo(0.4, 2)
  expect(color.b).toBeCloseTo(0.6, 2)

  const opacity = pageSection.getByRole('spinbutton', { name: 'Opacity' })
  await opacity.click()
  await opacity.fill('50')
  await opacity.press('Enter')
  await editor.canvas.waitForRender()

  color = await pageColor()
  expect(color.a).toBeCloseTo(0.5, 2)
  editor.canvas.assertNoErrors()
})
