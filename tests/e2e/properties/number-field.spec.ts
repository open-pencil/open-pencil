import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { propertyField } from '#tests/helpers/properties'
import { getSelectedNode } from '#tests/helpers/store'

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
  const before = await numericFieldValue(field)

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

test('NumberField exposes mixed state through canonical data attributes', async () => {
  await editor.canvas.drawRect(300, 100, 80, 80)
  await editor.canvas.selectAll()
  await editor.canvas.waitForRender()

  await expect(xField()).toHaveAttribute('data-mixed')
  await expect(xField()).not.toHaveAttribute('aria-valuenow')
  editor.canvas.assertNoErrors()
})
