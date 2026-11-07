import { expectDefined } from '@open-pencil/test-support/assert'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import type * as BoundSizeScene from '#tests/helpers/canvas/bound-size/scene'
import { pageScene } from '#tests/helpers/canvas/page-scene'
import { selectNode } from '#tests/helpers/components/properties'
import { propertyField } from '#tests/helpers/properties'
import { getNodeById, getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

function xField() {
  return propertyField(editor.page, 'x')
}

async function editField(field: ReturnType<typeof xField>) {
  await field.click()
  return field.getByRole('spinbutton', { name: 'X Axis' })
}

async function numericFieldValue(field: ReturnType<typeof xField>): Promise<number> {
  return Number(expectDefined(await field.getAttribute('aria-valuenow'), 'field value'))
}

test.beforeEach(async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(120, 100, 80, 80)
})

test('NumberField commits arithmetic and relative expressions', async () => {
  const field = xField()
  const before = await numericFieldValue(field)

  let input = await editField(field)
  await expect(field).not.toHaveAttribute('role')
  await expect(input).toHaveAttribute('role', 'spinbutton')
  await expect(input).toHaveAttribute('aria-label', 'X Axis')
  await expect(field.getByRole('spinbutton')).toHaveCount(1)
  await input.fill('*2')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before * 2)

  input = await editField(field)
  await input.fill('+10')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before * 2 + 10)
  await expect(field).toHaveAttribute('aria-valuenow', String(before * 2 + 10))
  editor.canvas.assertNoErrors()
})

test('NumberField invalid input and Escape restore the previous value', async () => {
  const field = xField()
  // Cancellation restores the exact graph coordinate, not its rounded display value.
  const before = expectDefined((await getSelectedNode(editor.page))?.x, 'original x')

  let input = await editField(field)
  await input.fill('77')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(77)
  await input.press('Escape')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before)

  input = await editField(field)
  await input.fill('constructor')
  await input.press('Enter')
  await editor.canvas.waitForRender()
  expect((await getSelectedNode(editor.page))?.x).toBe(before)
  await expect(field).not.toHaveAttribute('data-editing')
  editor.canvas.assertNoErrors()
})

test('NumberField Arrow keys honor Shift and Alt multipliers', async () => {
  const field = xField()
  const before = await numericFieldValue(field)
  const input = await editField(field)

  await input.press('ArrowUp')
  await input.press('Shift+ArrowUp')
  await input.press('Alt+ArrowDown')
  await input.press('Enter')
  await editor.canvas.waitForRender()

  expect((await getSelectedNode(editor.page))?.x).toBe(before + 10.9)
  editor.canvas.assertNoErrors()
})

test('mixed numeric edits cancel per-node values and commit zero in one undo step', async () => {
  await editor.canvas.drawRect(300, 100, 80, 80)
  await editor.canvas.selectAll()
  const values = () =>
    editor.page.evaluate(() =>
      window.openPencil
        ?.getStore?.()
        .getSelectedNodes()
        .map((node) => node.x)
    )
  const original = await values()
  let input = await editField(xField())
  await input.fill('77')
  expect(await values()).toEqual([77, 77])
  await input.press('Escape')
  expect(await values()).toEqual(original)
  input = await editField(xField())
  await input.fill('0')
  await input.press('Enter')
  expect(await values()).toEqual([0, 0])
  await editor.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
  expect(await values()).toEqual(original)
})

test('NumberField exposes mixed state through canonical data attributes', async () => {
  await editor.canvas.drawRect(300, 100, 80, 80)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  await expect(xField()).toHaveAttribute('data-mixed')
  await expect(xField()).not.toHaveAttribute('aria-valuenow')
  editor.canvas.assertNoErrors()
})

test('an untouched bound size sends nothing, and the next layer still takes a typed size', async () => {
  const ids = await pageScene<typeof BoundSizeScene>(
    () => editor.page,
    '/tests/helpers/canvas/bound-size/scene.ts'
  ).build('createBoundSizeScene')
  const width = () => editor.page.getByRole('spinbutton', { name: 'Width', exact: true })
  const widthOf = async (id: string) => (await getNodeById(editor.page, id))?.width

  await selectNode(editor.page, ids.remote)
  // The panel gives the field the rounded width, 100; the bound field begins from 100.4.
  await expect(width()).toHaveAttribute('aria-valuenow', '100.4')
  await width().focus()
  await expect(propertyField(editor.page, 'width')).toHaveAttribute('data-editing')
  await width().blur()
  await expect(propertyField(editor.page, 'width')).not.toHaveAttribute('data-editing')
  expect(await widthOf(ids.remote)).toBe(100.4)

  await selectNode(editor.page, ids.frame)
  await expect(width()).toHaveAttribute('aria-valuenow', '100')
  await width().focus()
  await width().fill('150')
  await width().press('Enter')
  await editor.canvas.waitForRender()
  expect([await widthOf(ids.frame), await widthOf(ids.bar)]).toEqual([150, 70])
  editor.canvas.assertNoErrors()
})
