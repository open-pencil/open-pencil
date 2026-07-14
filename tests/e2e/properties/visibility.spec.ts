import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { propertyItems, propertySection } from '#tests/helpers/properties'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

test('fill visibility supports repeat click and undo redo', async () => {
  await editor.canvas.drawRect(120, 120, 120, 80)
  await editor.canvas.waitForRender()

  const fillButton = propertyItems(editor.page, 'fills')
    .first()
    .getByRole('button', { name: 'Toggle visibility' })
  await expect(fillButton).toBeVisible()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').fills[0]?.visible).toBe(
    true
  )

  await fillButton.click()
  await editor.canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').fills[0]?.visible).toBe(
    false
  )

  await fillButton.click()
  await editor.canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').fills[0]?.visible).toBe(
    true
  )

  await editor.canvas.undo()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').fills[0]?.visible).toBe(
    false
  )

  await editor.canvas.redo()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').fills[0]?.visible).toBe(
    true
  )
})

test('empty list sections expose semantic empty state', async () => {
  await expect(propertySection(editor.page, 'Fill')).not.toHaveAttribute('data-empty')
  await expect(propertySection(editor.page, 'Stroke')).toHaveAttribute('data-empty', '')
  await expect(propertySection(editor.page, 'Effects')).toHaveAttribute('data-empty', '')
  await expect(propertySection(editor.page, 'Export')).toHaveAttribute('data-empty', '')
})

test('stroke visibility supports repeat click and undo redo', async () => {
  const strokeSection = propertySection(editor.page, 'Stroke')
  await strokeSection.getByRole('button', { name: 'Add stroke' }).click()
  await expect(strokeSection).not.toHaveAttribute('data-empty')
  await editor.canvas.waitForRender()

  const strokeButton = propertyItems(editor.page, 'strokes')
    .first()
    .getByRole('button', { name: 'Toggle visibility' })
  await expect(strokeButton).toBeVisible()
  expect(
    expectDefined(await getSelectedNode(editor.page), 'selected node').strokes[0]?.visible
  ).toBe(true)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  expect(
    expectDefined(await getSelectedNode(editor.page), 'selected node').strokes[0]?.visible
  ).toBe(false)

  await strokeButton.click()
  await editor.canvas.waitForRender()
  expect(
    expectDefined(await getSelectedNode(editor.page), 'selected node').strokes[0]?.visible
  ).toBe(true)

  await editor.canvas.undo()
  expect(
    expectDefined(await getSelectedNode(editor.page), 'selected node').strokes[0]?.visible
  ).toBe(false)

  await editor.canvas.redo()
  expect(
    expectDefined(await getSelectedNode(editor.page), 'selected node').strokes[0]?.visible
  ).toBe(true)
})

test('multi-selection list add is one undo step', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(100, 100, 80, 80)
  await editor.canvas.drawRect(240, 100, 80, 80)
  await editor.canvas.pressKey('Meta+a')

  const strokeCounts = () =>
    editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      return [...store.state.selectedIds].map((id) => store.getNode(id)?.strokes.length ?? -1)
    })

  await propertySection(editor.page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
  await editor.canvas.waitForRender()
  expect(await strokeCounts()).toEqual([1, 1])

  await editor.canvas.undo()
  expect(await strokeCounts()).toEqual([0, 0])
})

test('appearance visibility supports repeat click and undo redo in one step', async () => {
  const visibilityButton = propertySection(editor.page, 'Appearance').getByRole('button', {
    name: 'Toggle visibility'
  })
  await expect(visibilityButton).toBeVisible()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').visible).toBe(true)

  await visibilityButton.click()
  await editor.canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').visible).toBe(false)

  await visibilityButton.click()
  await editor.canvas.waitForRender()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').visible).toBe(true)

  await editor.canvas.undo()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').visible).toBe(false)

  await editor.canvas.undo()
  expect(expectDefined(await getSelectedNode(editor.page), 'selected node').visible).toBe(true)
})
