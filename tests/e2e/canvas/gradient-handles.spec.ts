import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { gradientDriver } from '#tests/helpers/canvas/gradient-driver'
import { propertyItems } from '#tests/helpers/properties'

// Figma desktop 126: while a gradient's picker is open the canvas shows its handles. An end moves
// exactly with the pointer, a stop square slides its stop along the line, and pressing either
// keeps the picker open.

const editor = useEditorSetupWithClear('/?test&no-rulers')

const gradient = gradientDriver(() => editor.page)

const bar = () => editor.page.getByTestId('fill-picker-gradient-bar').locator('[data-slot=stop]')

async function closePicker() {
  await editor.page.keyboard.press('Escape')
  await expect.poll(() => gradient.editing()).toBe(false)
}

async function openPicker() {
  const nodeId = await gradient.show('GRADIENT_LINEAR')
  await editor.canvas.waitForRender()
  await propertyItems(editor.page, 'fills')
    .first()
    .getByRole('button', { name: 'Fill', exact: true })
    .click()
  await expect(editor.page.getByTestId('fill-picker-gradient-bar')).toBeVisible()
  await expect.poll(() => gradient.editing()).toBe(true)
  return nodeId
}

test('dragging an end dot moves that end, and closing the picker leaves one undo step', async () => {
  const nodeId = await openPicker()
  const before = await gradient.fill(nodeId)
  const end = gradient.point(200, 70)
  const target = gradient.point(200, 10)
  await editor.canvas.drag(end.x, end.y, target.x, target.y)
  await editor.canvas.waitForRender()

  // The end follows the pointer to (200, 10), within the half screen pixel it lands on; the start
  // stays at the left edge's middle.
  const ends = await gradient.ends(nodeId)
  expect(ends?.start.x).toBeCloseTo(0, 0)
  expect(ends?.start.y).toBeCloseTo(70, 0)
  expect(ends?.end.x).toBeCloseTo(200, 0)
  expect(ends?.end.y).toBeCloseTo(10, 0)
  await expect(editor.page.getByTestId('fill-picker-gradient-bar')).toBeVisible()

  // Shortcuts wait for open popovers to close; closing the picker also hides the handles.
  await closePicker()
  await editor.canvas.undo()
  expect(await gradient.fill(nodeId)).toEqual(before)
  editor.canvas.assertNoErrors()
})

test('Escape during a drag puts the gradient back and leaves the picker open', async () => {
  const nodeId = await openPicker()
  const before = await gradient.fill(nodeId)
  const end = gradient.point(200, 70)
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Expected the canvas')
  await editor.page.mouse.move(box.x + end.x, box.y + end.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + end.x, box.y + end.y - 120, { steps: 5 })
  expect(await gradient.fill(nodeId)).not.toEqual(before)

  await editor.page.keyboard.press('Escape')
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
  expect(await gradient.fill(nodeId)).toEqual(before)
  await expect(editor.page.getByTestId('fill-picker-gradient-bar')).toBeVisible()
  await closePicker()
})

test('dragging a stop square slides the stop and selects it in the picker', async () => {
  const nodeId = await openPicker()
  // The middle stop's square sits above the line, half a square and the gap from it.
  const square = gradient.point(100, 70)
  await editor.canvas.drag(square.x, square.y - 18, square.x + 100, square.y - 18)
  await editor.canvas.waitForRender()

  const [first, moved, last] = (await gradient.fill(nodeId))?.stops ?? []
  expect([first, last]).toEqual([0, 1])
  // 50 layer pixels right of the middle, within the half screen pixel the pointer lands on.
  expect(moved).toBeCloseTo(0.75, 2)
  expect(await gradient.editedStop()).toBe(1)
  await expect(bar().nth(1)).toHaveAttribute('data-selected', '')
  await closePicker()
  editor.canvas.assertNoErrors()
})

test('selecting a stop in the picker selects its square on the canvas', async () => {
  await openPicker()
  await bar().nth(2).click()
  await expect.poll(() => gradient.editedStop()).toBe(2)
  await closePicker()
})
