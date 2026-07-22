import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getSelectedNode } from '#tests/helpers/store'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetup()

test('creates and resizes a frame with presets', async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('openPencil store not available')
    const id = store.createShape('RECTANGLE', 100, 100, 80, 80)
    store.select([id])
  })

  await editor.canvas.pressKey('f')
  await expect(editor.page.getByRole('region', { name: 'Frame' })).toBeVisible()
  await expect(editor.page.getByRole('button', { name: 'iPhone Air 420 × 912' })).toBeVisible()
  await expect(editor.page.getByRole('button', { name: 'iPad mini 8.3 744 × 1133' })).toBeHidden()

  await editor.page.getByRole('button', { name: 'Tablet', exact: true }).click()
  await expect(editor.page.getByRole('button', { name: 'iPad mini 8.3 744 × 1133' })).toBeVisible()

  await editor.page.getByRole('button', { name: 'iPhone Air 420 × 912' }).click()
  await editor.canvas.waitForRender()

  let frame = await getSelectedNode(editor.page)
  expect(frame).toMatchObject({ type: 'FRAME', name: 'iPhone Air', width: 420, height: 912 })
  await expect(editor.page.getByTestId(toolbarToolTestId('SELECT'))).toHaveAttribute(
    'data-active',
    'true'
  )

  await editor.canvas.undo()
  expect(await getSelectedNode(editor.page)).toMatchObject({ type: 'RECTANGLE' })

  await editor.canvas.redo()
  expect(await getSelectedNode(editor.page)).toMatchObject({
    type: 'FRAME',
    name: 'iPhone Air',
    width: 420,
    height: 912
  })

  const framePreset = editor.page.getByRole('combobox', { name: 'Frame preset' })
  await framePreset.click()
  await expect(editor.page.getByRole('option', { name: 'Wireframe', exact: true })).toHaveCount(0)
  await editor.page.getByRole('option', { name: 'Desktop', exact: true }).click()
  await editor.canvas.waitForRender()

  frame = await getSelectedNode(editor.page)
  expect(frame).toMatchObject({ type: 'FRAME', name: 'iPhone Air', width: 1440, height: 1024 })
  await expect(framePreset).toContainText('Desktop')

  await editor.canvas.undo()
  expect(await getSelectedNode(editor.page)).toMatchObject({
    type: 'FRAME',
    name: 'iPhone Air',
    width: 420,
    height: 912
  })

  await editor.canvas.redo()
  expect(await getSelectedNode(editor.page)).toMatchObject({
    type: 'FRAME',
    name: 'iPhone Air',
    width: 1440,
    height: 1024
  })
})
