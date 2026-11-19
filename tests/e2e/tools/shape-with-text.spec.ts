import type { Vector } from '@open-pencil/scene-graph/primitives'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { boardDriver } from '#tests/helpers/canvas/board-driver'
import { shapeWithTextDriver } from '#tests/helpers/canvas/shape-with-text-driver'
import { propertyField, propertySection } from '#tests/helpers/properties'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetupWithClear()
const shapes = shapeWithTextDriver(() => editor.page)
const board = boardDriver(() => editor.page)

test.beforeEach(async () => {
  await editor.page.keyboard.press('Escape')
  await shapes.showOrigin()
})

test.afterEach(() => board.close())

async function lastShape() {
  const shape = (await shapes.shapes()).at(-1)
  if (!shape) throw new Error('Missing shape with text')
  return shape
}

async function clickAt(x: number, y: number) {
  const point = shapes.point(x, y)
  await editor.canvas.click(point.x, point.y)
  await editor.canvas.waitForRender()
}

async function dragFrom(from: Vector, to: Vector) {
  const box = await editor.canvas.canvas.boundingBox()
  if (!box) throw new Error('Missing canvas')
  const start = shapes.point(from.x, from.y)
  const end = shapes.point(to.x, to.y)
  await editor.page.mouse.move(box.x + start.x, box.y + start.y)
  await editor.page.mouse.down()
  await editor.page.mouse.move(box.x + end.x, box.y + end.y, { steps: 6 })
  await editor.page.mouse.up()
  await editor.canvas.waitForRender()
}

test('the toolbar keeps the shape tool hidden', async () => {
  await expect(editor.page.getByTestId(toolbarToolTestId('SHAPE_WITH_TEXT'))).toHaveCount(0)
})

test('a picked kind is placed by a click, as FigJam places it, with its label to type into', async () => {
  await shapes.showTool()
  await shapes.pickKind('Diamond')
  expect((await shapes.focus()).tool).toBe('SHAPE_WITH_TEXT')
  await clickAt(300, 200)
  const placed = await lastShape()
  expect(placed).toMatchObject({
    kind: 'DIAMOND',
    x: 300,
    y: 200,
    width: 176,
    height: 176,
    fill: '#ffffff',
    stroke: '#757575',
    strokeWeight: 4,
    label: { text: '', fontSize: 16 }
  })
  expect(await shapes.focus()).toMatchObject({ tool: 'SELECT', selected: [placed.id] })
  expect((await shapes.focus()).editing).not.toBeNull()

  await editor.page.keyboard.type('Valid?')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  expect(await lastShape()).toMatchObject({ name: 'Valid?', label: { text: 'Valid?' } })
})

test('the tool keeps the kind picked last, and a drag draws the shape as large as the drag', async () => {
  await shapes.showTool()
  await shapes.pickKind('Cylinder')
  await clickAt(100, 100)
  await editor.page.keyboard.press('Escape')
  await editor.page.keyboard.press('Escape')
  const before = (await shapes.shapes()).length

  await editor.page.getByTestId(toolbarToolTestId('SHAPE_WITH_TEXT')).click()
  const cylinder = editor.page.getByRole('option', { name: 'Cylinder', exact: true })
  await expect(cylinder).toHaveAttribute('data-selected', 'true')
  await cylinder.click()
  await dragFrom({ x: 400, y: 100 }, { x: 640, y: 260 })
  expect(await lastShape()).toMatchObject({
    kind: 'ENG_DATABASE',
    x: 400,
    y: 100,
    width: 240,
    height: 160
  })
  await editor.page.keyboard.press('Escape')
  // Drawing it was one step.
  await editor.page.keyboard.press('ControlOrMeta+z')
  await editor.canvas.waitForRender()
  expect(await shapes.shapes()).toHaveLength(before)
})

// FigJam: on a board R arms a square, whatever kind the Shapes panel picked last.
test('R on a board arms a square shape, not the kind picked last', async () => {
  await shapes.showTool()
  await shapes.pickKind('Cylinder')
  await editor.page.keyboard.press('Escape')
  await board.open()
  await editor.canvas.click(20, 20)
  await editor.page.keyboard.press('r')
  await clickAt(400, 200)
  await editor.page.keyboard.press('Escape')
  expect((await lastShape()).kind).toBe('SQUARE')
})

test("a shape's panel keeps to FigJam's choices, without free-form typography or corners", async () => {
  await shapes.showTool()
  await shapes.pickKind('Square')
  await clickAt(200, 200)
  await editor.page.keyboard.type('Ship it')
  await editor.page.keyboard.press('Escape')

  for (const section of ['Typography', 'Appearance', 'Fill', 'Stroke', 'Effects']) {
    await expect(propertySection(editor.page, section)).toHaveCount(0)
  }
  await expect(propertyField(editor.page, 'cornerRadius')).toHaveCount(0)
})

test('a shape whose height was set keeps it, and cuts a long label off with "…"', async () => {
  await shapes.showTool()
  await shapes.pickKind('Square')
  await clickAt(200, 200)
  await editor.page.keyboard.press('Escape')

  const heightField = propertyField(editor.page, 'height')
  await heightField.click()
  const height = heightField.getByRole('spinbutton', { name: 'Height' })
  await height.fill('100')
  await height.press('Enter')
  expect(await lastShape()).toMatchObject({ height: 100, truncates: true })

  await editor.page.keyboard.press('Enter')
  await editor.page.keyboard.type('A label far too long for a shape only one hundred pixels tall')
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()
  const shape = await lastShape()
  expect(shape).toMatchObject({ width: 176, height: 100 })
  expect(shape.label?.truncation).toBe('ENDING')
})
