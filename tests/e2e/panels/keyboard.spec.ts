import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { propertySection } from '#tests/helpers/properties'

const editor = useEditorSetupWithClear()

test('property fields follow keyboard tab order', async () => {
  await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
      x: 120,
      y: 140,
      width: 180,
      height: 100
    })
    store.select([node.id])
  })
  await editor.canvas.waitForRender()

  const position = propertySection(editor.page, 'Position')
  const x = position.getByRole('spinbutton', { name: 'X Axis' })
  const y = position.getByRole('spinbutton', { name: 'Y Axis' })
  await x.focus()
  await expect(x).toBeFocused()
  await editor.page.keyboard.press('Tab')
  await expect(y).toBeFocused()
  await editor.page.keyboard.press('Shift+Tab')
  await expect(x).toBeFocused()
})

test('select and switch controls work from the keyboard', async () => {
  const textId = await editor.page.evaluate(() => {
    const store = window.lawha?.getStore?.()
    if (!store) throw new Error('Lawha store not initialized')
    const node = store.graph.createNode('TEXT', store.state.currentPageId, {
      text: 'Keyboard typography',
      x: 120,
      y: 140,
      width: 260,
      height: 80
    })
    store.select([node.id])
    return node.id
  })
  await editor.canvas.waitForRender()

  const typography = propertySection(editor.page, 'Typography')
  const textCase = typography.getByRole('combobox', { name: 'Text case' })
  await textCase.focus()
  await editor.page.keyboard.press('Enter')
  const uppercase = editor.page.getByRole('option', { name: 'Uppercase' })
  await expect(uppercase).toBeVisible()
  await uppercase.focus()
  await editor.page.keyboard.press('Enter')
  await expect(uppercase).not.toBeVisible()

  const ligatures = editor.page.getByRole('switch', { name: 'Standard ligatures' })
  await expect(ligatures).toBeVisible()
  await ligatures.focus()
  await editor.page.keyboard.press('Space')
  await editor.canvas.waitForRender()

  const state = await editor.page.evaluate((id) => {
    const store = window.lawha?.getStore?.()
    const node = store?.graph.getNode(id)
    return node ? { textCase: node.textCase, fontFeatures: node.fontFeatures } : null
  }, textId)
  expect(state?.textCase).toBe('UPPER')
  expect(state?.fontFeatures).toContainEqual({ tag: 'LIGA', enabled: false })
})
